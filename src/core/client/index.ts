import * as http from "node:http";
import * as https from "node:https";
import * as vscode from "vscode";
import { Collections } from "../../../typings/filesystem";

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

let outputChannel: vscode.OutputChannel | undefined;
const activeExecutions = new Map<string, { stop: () => void }>();
const listeners = new Set<ClientListener>();

export function getClientOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel("Vortex Client");
  }
  return outputChannel;
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

function appendDivider(channel: vscode.OutputChannel): void {
  channel.appendLine("------------------------------------------------------------");
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

function buildRequestLabel(param: ClientRequestPayload): string {
  return `${normalizeMethod(param.type)} ${param.name ?? param.id}`;
}

function appendRequestIntro(channel: vscode.OutputChannel, param: ClientRequestPayload): void {
  appendDivider(channel);
  channel.appendLine(`[send] ${buildRequestLabel(param)}`);
  channel.appendLine(`url: ${param.url ?? ""}`);
}

function appendRequestHeaders(channel: vscode.OutputChannel, headers: Record<string, string> | undefined): void {
  const pairs = Object.entries(headers ?? {});
  if (pairs.length === 0) {
    return;
  }

  channel.appendLine("headers:");
  for (const [key, value] of pairs) {
    channel.appendLine(`  ${key}: ${value}`);
  }
}

function appendRequestBody(channel: vscode.OutputChannel, body: string | undefined): void {
  if (!body) {
    return;
  }

  channel.appendLine("body:");
  channel.appendLine(body);
}

function ensureUrl(input: string | undefined): URL {
  if (!input) {
    throw new Error("Request URL is empty.");
  }

  return new URL(input);
}

function sendHttpRequest(param: ClientRequestPayload, channel: vscode.OutputChannel, runtimeResponse: ClientRunResult): RequestExecution {
  const url = ensureUrl(param.url);
  const client = url.protocol === "https:" ? https : http;
  const body = param.body ?? "";

  const request = client.request(url, {
    method: normalizeMethod(param.type),
    headers: param.headers ?? {}
  });

  const completed = new Promise<void>((resolve, reject) => {
    request.once("response", response => {
      const chunks: Buffer[] = [];
      response.on("data", chunk => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      response.on("end", () => {
        runtimeResponse.status = response.statusCode ?? 0;
        runtimeResponse.statusText = response.statusMessage ?? "";
        runtimeResponse.headers = response.headers as Record<string, unknown>;
        channel.appendLine(`status: ${response.statusCode ?? 0} ${response.statusMessage ?? ""}`.trim());
        channel.appendLine(`response headers: ${JSON.stringify(response.headers, null, 2)}`);
        const responseText = Buffer.concat(chunks).toString("utf8");
        runtimeResponse.body = responseText;
        if (responseText) {
          channel.appendLine("response body:");
          channel.appendLine(responseText);
        }
        resolve();
      });
    });

    request.once("connect", (response, socket, head) => {
      runtimeResponse.status = response.statusCode ?? 0;
      runtimeResponse.statusText = response.statusMessage ?? "";
      runtimeResponse.meta = { headBytes: head.length };
      channel.appendLine(`connect: ${response.statusCode ?? 0} ${response.statusMessage ?? ""}`.trim());
      if (head.length > 0) {
        channel.appendLine(`connect head bytes: ${head.length}`);
      }
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

async function consumeSseStream(response: Response, channel: vscode.OutputChannel, runtimeResponse: ClientRunResult): Promise<void> {
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
        runtimeResponse.events.push(block);
        channel.appendLine(`event: ${block}`);
      }
      boundaryIndex = pending.indexOf("\n\n");
    }
  }

  const tail = pending.trim();
  if (tail) {
    runtimeResponse.events.push(tail);
    channel.appendLine(`event: ${tail}`);
  }
}

function sendSseRequest(param: ClientRequestPayload, channel: vscode.OutputChannel, runtimeResponse: ClientRunResult): RequestExecution {
  const controller = new AbortController();
  const url = ensureUrl(param.url);
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
    channel.appendLine(`status: ${response.status} ${response.statusText}`.trim());
    channel.appendLine(`response headers: ${JSON.stringify(headersToRecord(response.headers), null, 2)}`);
    await consumeSseStream(response, channel, runtimeResponse);
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

function sendWebSocketRequest(param: ClientRequestPayload, channel: vscode.OutputChannel, runtimeResponse: ClientRunResult): RequestExecution {
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
        url: normalizeWebSocketUrl(param.url)
      };
      channel.appendLine("websocket: open");
      if (param.body) {
        socket.send(param.body);
        channel.appendLine(`websocket sent: ${param.body}`);
      }
    });
    socket.addEventListener("message", event => {
      const message = String(event.data);
      runtimeResponse.events.push(message);
      channel.appendLine(`websocket message: ${message}`);
    });
    socket.addEventListener("error", () => {
      finish(() => reject(new Error("WebSocket connection failed.")));
    });
    socket.addEventListener("close", event => {
      channel.appendLine(`websocket close: ${event.code} ${event.reason}`);
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

function createExecution(param: ClientRequestPayload, channel: vscode.OutputChannel, runtimeResponse: ClientRunResult): RequestExecution {
  const method = normalizeMethod(param.type);
  if (method === "WEBSOCKET") {
    return sendWebSocketRequest(param, channel, runtimeResponse);
  }
  if (method === "SSE" || method === "EVENTSOURCE") {
    return sendSseRequest(param, channel, runtimeResponse);
  }
  return sendHttpRequest(param, channel, runtimeResponse);
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

  const channel = getClientOutputChannel();
  const resolved = resolvePayload(param);
  const runtimeResponse: ClientRunResult = {
    events: []
  };
  channel.show(true);

  const execution = createExecution(resolved, channel, runtimeResponse);
  beginExecution(param.id, execution.stop);

  try {
    appendRequestIntro(channel, resolved);
    appendRequestHeaders(channel, resolved.headers);
    appendRequestBody(channel, resolved.body);
    await execution.completed;
    channel.appendLine(`[done] ${buildRequestLabel(resolved)}`);
    return runtimeResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    runtimeResponse.error = message;
    if (message !== "The operation was aborted" && message !== "Stopped by user.") {
      channel.appendLine(`[error] ${buildRequestLabel(resolved)}: ${message}`);
      void vscode.window.showErrorMessage(`Request failed: ${message}`);
    } else {
      channel.appendLine(`[stopped] ${buildRequestLabel(resolved)}`);
    }
    return runtimeResponse;
  } finally {
    endExecution(param.id);
    appendDivider(channel);
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
