import * as http from "node:http";
import * as https from "node:https";
import * as vscode from "vscode";
import { Collections } from "../../../typings/filesystem";
import { ClientLogView, getClientPanel } from "../../views/clientPanel";

export interface ClientRequestPayload extends Partial<Collections> {
  id: string;
  documentUri?: vscode.Uri;
}

export interface ClientState {
  busy: boolean;
  activeRequestIds: string[];
}

type ClientListener = (state: ClientState) => void;

interface RequestExecution {
  completed: Promise<void>;
  stop: () => void;
}

export interface ClientRunResult {
  status?: number;
  statusText?: string;
  headers?: Record<string, unknown>;
  body?: string;
  events: string[];
  error?: string;
  meta?: Record<string, unknown>;
}

interface TimingMetrics {
  dnsMs?: number;
  connectMs?: number;
  tlsMs?: number;
  ttfbMs?: number;
  totalMs: number;
}

interface RuntimeWebSocket {
  readonly readyState: number;
  readonly CLOSING: number;
  readonly CLOSED: number;
  addEventListener(type: string, listener: (event?: any) => void): void;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

type HttpLikeMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "HEAD"
  | "OPTIONS"
  | "CONNECT"
  | "TRACE"
  | "SUBSCRIBE"
  | "UNSUBSCRIBE";

type ClientMethod = HttpLikeMethod | "WEBSOCKET" | "SSE" | "EVENTSOURCE";

const HTTP_METHODS = new Set<HttpLikeMethod>([
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD",
  "OPTIONS",
  "CONNECT",
  "TRACE",
  "SUBSCRIBE",
  "UNSUBSCRIBE"
]);

const activeExecutions = new Map<string, { stop: () => void }>();
const listeners = new Set<ClientListener>();

export function getClientOutputChannel(): ClientLogView {
  return getClientPanel();
}

function getClientState(): ClientState {
  return {
    busy: activeExecutions.size > 0,
    activeRequestIds: Array.from(activeExecutions.keys())
  };
}

function emitState(): void {
  const state = getClientState();
  for (const listener of listeners) {
    listener(state);
  }
}

function beginExecution(id: string, stop: () => void): void {
  activeExecutions.set(id, { stop });
  emitState();
}

function endExecution(id: string): void {
  if (!activeExecutions.has(id)) {
    return;
  }
  activeExecutions.delete(id);
  emitState();
}

function formatLogTime(date: Date): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function formatClockMs(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mi}:${ss}.${ms}`;
}

function formatEventLine(payload: string, eventType = "message"): string {
  if (eventType === "message") {
    return `[${formatClockMs(new Date())}] ${payload}`;
  }
  return `[${formatClockMs(new Date())}] ${eventType} ${payload}`;
}

function buildRequestId(request: ClientRequestPayload, startedAt: number): string {
  return `${request.id}-${startedAt}`;
}

function flattenHeaderEntries(headers: Record<string, unknown> | undefined): Array<[string, string]> {
  if (!headers) {
    return [];
  }

  return Object.entries(headers).map(([key, value]) => {
    if (Array.isArray(value)) {
      return [key.toLowerCase(), value.join(",")] as [string, string];
    }

    if (value === undefined || value === null) {
      return [key.toLowerCase(), ""] as [string, string];
    }

    return [key.toLowerCase(), String(value)] as [string, string];
  }).sort(([left], [right]) => left.localeCompare(right));
}

function isStrictLogFormatEnabled(): boolean {
  try {
    const workspace = Reflect.get(vscode as unknown as object, "workspace") as {
      getConfiguration?: (section?: string) => { get?: (key: string, defaultValue?: boolean) => boolean };
    } | undefined;
    return workspace?.getConfiguration?.("vortex.output")?.get?.("strictLogFormat", true) ?? true;
  } catch {
    return true;
  }
}

function normalizeMethod(type?: string): ClientMethod {
  const normalized = (type ?? "GET").trim().toUpperCase() as ClientMethod;
  if (
    normalized === "WEBSOCKET"
    || normalized === "SSE"
    || normalized === "EVENTSOURCE"
    || HTTP_METHODS.has(normalized as HttpLikeMethod)
  ) {
    return normalized;
  }
  return "GET";
}

function resolvePayload(param: ClientRequestPayload): ClientRequestPayload {
  return {
    ...param,
    type: normalizeMethod(param.type),
  };
}

function toBodyText(response: ClientRunResult): string {
  const MAX_PREVIEW_BYTES = 8 * 1024;
  if (response.body && response.body.length > 0) {
    const totalBytes = Buffer.byteLength(response.body, "utf8");
    if (totalBytes <= MAX_PREVIEW_BYTES) {
      return response.body;
    }
    const preview = Buffer.from(response.body, "utf8").subarray(0, MAX_PREVIEW_BYTES).toString("utf8");
    return `${preview}\n...[truncated ${totalBytes - MAX_PREVIEW_BYTES} bytes]`;
  }

  if (response.events.length > 0) {
    const raw = response.events.join("\n");
    const totalBytes = Buffer.byteLength(raw, "utf8");
    if (totalBytes <= MAX_PREVIEW_BYTES) {
      return raw;
    }
    const preview = Buffer.from(raw, "utf8").subarray(0, MAX_PREVIEW_BYTES).toString("utf8");
    return `${preview}\n...[truncated ${totalBytes - MAX_PREVIEW_BYTES} bytes]`;
  }

  return "[]";
}

function maskHeaderValue(key: string, value: string): string {
  if (key.toLowerCase() !== "authorization") {
    return value;
  }

  if (value.toLowerCase().startsWith("bearer ")) {
    return "Bearer ****** (masked)";
  }

  return "****** (masked)";
}

function appendHeaderBlock(channel: ClientLogView, headers: Array<[string, string]>): void {
  for (const [key, value] of headers) {
    channel.appendLine(`${key}: ${maskHeaderValue(key, value)}`);
  }
}

function appendExchangeLog(
  channel: ClientLogView,
  request: ClientRequestPayload,
  runtimeResponse: ClientRunResult,
  durationMs: number
): void {
  const strictLogFormat = isStrictLogFormatEnabled();
  const method = normalizeMethod(request.type);
  const url = request.url ?? "";
  const requestHeaders = flattenHeaderEntries(request.headers as Record<string, unknown> | undefined);
  const responseHeaders = flattenHeaderEntries(runtimeResponse.headers);
  const responseBodyText = toBodyText(runtimeResponse);
  const timings = runtimeResponse.meta?.timings as TimingMetrics | undefined;
  const hasResponseStatus = typeof runtimeResponse.status === "number" && runtimeResponse.status > 0;
  const isFailed = Boolean(runtimeResponse.error || !hasResponseStatus);
  const statusLine = isFailed
    ? "FAILED"
    : `${runtimeResponse.status ?? 0} ${runtimeResponse.statusText ?? ""}`.trim();
  const responseContentType = responseHeaders.find(([key]) => key === "content-type")?.[1] ?? "(none)";

  if (strictLogFormat) {
    channel.appendLine(`${method} ${url} HTTP/1.1`);
    appendHeaderBlock(channel, requestHeaders);
    channel.appendLine("");
    if (isFailed) {
      channel.appendLine("请求失败");
      return;
    }
    channel.appendLine(`status: ${statusLine}`);
    channel.appendLine(`duration: ${durationMs}ms`);
    channel.appendLine(`content-type: ${responseContentType}`);
    const hasDetailedTimings = Boolean(
      timings
      && (timings.dnsMs !== undefined
        || timings.connectMs !== undefined
        || timings.tlsMs !== undefined
        || timings.ttfbMs !== undefined)
    );
    if (hasDetailedTimings && timings) {
      channel.appendLine(
        `timings: dns=${timings.dnsMs ?? "-"}ms connect=${timings.connectMs ?? "-"}ms tls=${timings.tlsMs ?? "-"}ms ttfb=${timings.ttfbMs ?? "-"}ms total=${timings.totalMs}ms`
      );
    }
    for (const [key, value] of responseHeaders) {
      if (key === "content-type") {
        continue;
      }
      channel.appendLine(`${key}: ${value}`);
    }
    channel.appendLine("");
    channel.appendLine(`status: ${statusLine}`);
    channel.appendLine(`duration: ${durationMs}ms`);
    channel.appendLine(`content-type: ${responseContentType}`);
    for (const [key, value] of responseHeaders) {
      if (key === "content-type") {
        continue;
      }
      channel.appendLine(`${key}: ${value}`);
    }
    channel.appendLine(responseBodyText);
    return;
  }

  channel.appendLine(`${method} ${url} ${statusLine} ${durationMs}ms`);
  channel.appendLine(responseBodyText);
}

function ensureUrl(input: string | undefined): URL {
  if (!input) {
    throw new Error("Request URL is empty.");
  }

  return new URL(input);
}

function sendHttpRequest(param: ClientRequestPayload, runtimeResponse: ClientRunResult): RequestExecution {
  const url = ensureUrl(param.url);
  const client = url.protocol === "https:" ? https : http;
  const body = param.body ?? "";
  const startedAt = Date.now();
  const marks: {
    dnsAt?: number;
    connectAt?: number;
    secureAt?: number;
    firstByteAt?: number;
  } = {};

  const request = client.request(url, {
    method: normalizeMethod(param.type),
    headers: param.headers ?? {}
  });

  request.once("socket", socket => {
    socket.once("lookup", () => {
      marks.dnsAt = Date.now();
    });
    socket.once("connect", () => {
      marks.connectAt = Date.now();
    });
    socket.once("secureConnect", () => {
      marks.secureAt = Date.now();
    });
  });

  const completed = new Promise<void>((resolve, reject) => {
    request.once("response", response => {
      marks.firstByteAt = Date.now();
      const chunks: Buffer[] = [];
      response.on("data", chunk => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      response.on("end", () => {
        runtimeResponse.status = response.statusCode ?? 0;
        runtimeResponse.statusText = response.statusMessage ?? "";
        runtimeResponse.headers = response.headers as Record<string, unknown>;
        runtimeResponse.meta = {
          ...(runtimeResponse.meta ?? {}),
          responseAt: formatLogTime(new Date()),
          timings: {
            dnsMs: marks.dnsAt ? marks.dnsAt - startedAt : undefined,
            connectMs: marks.connectAt ? marks.connectAt - startedAt : undefined,
            tlsMs: marks.secureAt ? marks.secureAt - startedAt : undefined,
            ttfbMs: marks.firstByteAt ? marks.firstByteAt - startedAt : undefined,
            totalMs: Date.now() - startedAt
          } as TimingMetrics
        };
        const responseText = Buffer.concat(chunks).toString("utf8");
        runtimeResponse.body = responseText;
        resolve();
      });
    });

    request.once("connect", (response, socket, head) => {
      runtimeResponse.status = response.statusCode ?? 0;
      runtimeResponse.statusText = response.statusMessage ?? "";
      runtimeResponse.headers = response.headers as Record<string, unknown>;
      runtimeResponse.meta = {
        ...(runtimeResponse.meta ?? {}),
        headBytes: head.length,
        responseAt: formatLogTime(new Date()),
        timings: {
          dnsMs: marks.dnsAt ? marks.dnsAt - startedAt : undefined,
          connectMs: marks.connectAt ? marks.connectAt - startedAt : undefined,
          tlsMs: marks.secureAt ? marks.secureAt - startedAt : undefined,
          ttfbMs: Date.now() - startedAt,
          totalMs: Date.now() - startedAt
        } as TimingMetrics
      };
      runtimeResponse.body = "";
      socket.end();
      resolve();
    });

    request.once("error", reject);
  });

  if (body) {
    request.write(body);
  }
  request.end();

  return {
    completed,
    stop: () => request.destroy(new Error("Stopped by user."))
  };
}

function headersToRecord(headers: Headers): Record<string, string> {
  const output: Record<string, string> = {};
  headers.forEach((value, key) => {
    output[key] = value;
  });
  return output;
}

async function consumeSseStream(response: Response, runtimeResponse: ClientRunResult): Promise<void> {
  if (!response.body) {
    return;
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let pending = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    pending += decoder.decode(value, { stream: true });
    let boundaryIndex = pending.indexOf("\n\n");
    while (boundaryIndex !== -1) {
      const block = pending.slice(0, boundaryIndex).trim();
      pending = pending.slice(boundaryIndex + 2);
      if (block) {
        const lines = block.split("\n");
        let eventType = "message";
        const dataParts: string[] = [];
        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventType = line.slice(6).trim() || "message";
          }
          if (line.startsWith("data:")) {
            dataParts.push(line.slice(5).trim());
          }
        }
        const payload = dataParts.length > 0 ? dataParts.join("\n") : block;
        runtimeResponse.events.push(formatEventLine(payload, eventType));
      }
      boundaryIndex = pending.indexOf("\n\n");
    }
  }

  const tail = pending.trim();
  if (tail) {
    runtimeResponse.events.push(formatEventLine(tail, "message"));
  }
}

function sendSseRequest(param: ClientRequestPayload, runtimeResponse: ClientRunResult): RequestExecution {
  const controller = new AbortController();
  const url = ensureUrl(param.url);
  const startedAt = Date.now();
  const headers = {
    Accept: "text/event-stream",
    ...(param.headers ?? {})
  };

  const completed = (async () => {
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal
    });

    runtimeResponse.status = response.status;
    runtimeResponse.statusText = response.statusText;
    runtimeResponse.headers = headersToRecord(response.headers);
    runtimeResponse.meta = {
      ...(runtimeResponse.meta ?? {}),
      responseAt: formatLogTime(new Date()),
      timings: {
        ttfbMs: Date.now() - startedAt,
        totalMs: Date.now() - startedAt
      } as TimingMetrics
    };
    await consumeSseStream(response, runtimeResponse);
    runtimeResponse.meta = {
      ...(runtimeResponse.meta ?? {}),
      timings: {
        ...((runtimeResponse.meta?.timings as TimingMetrics | undefined) ?? { }),
        totalMs: Date.now() - startedAt
      } as TimingMetrics
    };
  })();

  return {
    completed,
    stop: () => controller.abort()
  };
}

function normalizeWebSocketUrl(input: string | undefined): string {
  const url = ensureUrl(input);
  if (url.protocol === "http:") {
    url.protocol = "ws:";
  } else if (url.protocol === "https:") {
    url.protocol = "wss:";
  }
  return url.toString();
}

function sendWebSocketRequest(param: ClientRequestPayload, runtimeResponse: ClientRunResult): RequestExecution {
  const startedAt = Date.now();
  const WebSocketCtor = (globalThis as { WebSocket?: new (url: string) => RuntimeWebSocket }).WebSocket;
  if (!WebSocketCtor) {
    throw new Error("Global WebSocket is not available in this runtime.");
  }

  const socket = new WebSocketCtor(normalizeWebSocketUrl(param.url));
  const completed = new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      callback();
    };

    socket.addEventListener("open", () => {
      runtimeResponse.meta = {
        ...(runtimeResponse.meta ?? {}),
        protocol: "websocket",
        url: normalizeWebSocketUrl(param.url),
        responseAt: formatLogTime(new Date()),
        timings: {
          ttfbMs: Date.now() - startedAt,
          totalMs: Date.now() - startedAt
        } as TimingMetrics
      };
      if (param.body) {
        socket.send(param.body);
      }
    });
    socket.addEventListener("message", event => {
      const message = String(event.data);
      runtimeResponse.events.push(formatEventLine(message, "message"));
    });
    socket.addEventListener("error", () => {
      finish(() => reject(new Error("WebSocket connection failed.")));
    });
    socket.addEventListener("close", event => {
      runtimeResponse.meta = {
        ...(runtimeResponse.meta ?? {}),
        closeCode: event.code,
        closeReason: event.reason,
        timings: {
          ...((runtimeResponse.meta?.timings as TimingMetrics | undefined) ?? { }),
          totalMs: Date.now() - startedAt
        } as TimingMetrics
      };
      finish(resolve);
    });
  });

  return {
    completed,
    stop: () => {
      if (socket.readyState === socket.CLOSING || socket.readyState === socket.CLOSED) {
        return;
      }
      socket.close(1000, "Stopped by user");
    }
  };
}

function createExecution(param: ClientRequestPayload, runtimeResponse: ClientRunResult): RequestExecution {
  const method = normalizeMethod(param.type);
  if (method === "WEBSOCKET") {
    return sendWebSocketRequest(param, runtimeResponse);
  }
  if (method === "SSE" || method === "EVENTSOURCE") {
    return sendSseRequest(param, runtimeResponse);
  }
  return sendHttpRequest(param, runtimeResponse);
}

export function onDidChangeClientState(listener: ClientListener): vscode.Disposable {
  listeners.add(listener);
  listener(getClientState());
  return new vscode.Disposable(() => {
    listeners.delete(listener);
  });
}

export function isClientBusy(): boolean {
  return getClientState().busy;
}

export function isRequestRunning(id: string): boolean {
  return activeExecutions.has(id);
}

export function getActiveRequestId(): string | undefined {
  return getClientState().activeRequestIds[0];
}

export async function send(param: ClientRequestPayload): Promise<ClientRunResult> {
  if (activeExecutions.has(param.id)) {
    throw new Error(`Request is already running: ${param.id}`);
  }

  const startedAt = Date.now();
  const channel = getClientOutputChannel();
  const resolved = resolvePayload(param);
  const runtimeResponse: ClientRunResult = {
    events: [],
    meta: {
      requestAt: formatLogTime(new Date()),
      requestId: buildRequestId(resolved, startedAt)
    }
  };
  channel.show(true);

  const execution = createExecution(resolved, runtimeResponse);
  beginExecution(param.id, execution.stop);

  try {
    await execution.completed;
    if (runtimeResponse.status === undefined && !runtimeResponse.error) {
      runtimeResponse.error = "No response received.";
      runtimeResponse.body = "No response received.";
    }
    const durationMs = Date.now() - startedAt;
    appendExchangeLog(channel, resolved, runtimeResponse, durationMs);
    return runtimeResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    runtimeResponse.error = message;
    runtimeResponse.meta = {
      ...(runtimeResponse.meta ?? {}),
      responseAt: String(runtimeResponse.meta?.responseAt ?? formatLogTime(new Date())),
      timings: {
        ...((runtimeResponse.meta?.timings as TimingMetrics | undefined) ?? { }),
        totalMs: Date.now() - startedAt
      } as TimingMetrics
    };
    runtimeResponse.body = message;
    appendExchangeLog(channel, resolved, runtimeResponse, Date.now() - startedAt);
    if (message !== "The operation was aborted" && message !== "Stopped by user.") {
      void vscode.window.showErrorMessage(`Request failed: ${message}`);
    }
    return runtimeResponse;
  } finally {
    endExecution(param.id);
  }
}

export async function stop(id: string): Promise<void> {
  const execution = activeExecutions.get(id);
  if (!execution) {
    return;
  }

  execution.stop();
}

export default send;
