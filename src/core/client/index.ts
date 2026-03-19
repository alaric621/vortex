import * as http from "node:http";
import * as https from "node:https";
import * as vscode from "vscode";
import { getVhtVariables } from "../../env";
import { Collections } from "../../../typings/filesystem";

export interface ClientRequestPayload extends Partial<Collections> {
  id: string;
  documentUri?: vscode.Uri;
}

export interface ClientState {
  busy: boolean;
  activeRequestId?: string;
}

type ClientListener = (state: ClientState) => void;

interface RequestExecution {
  completed: Promise<void>;
  stop: () => void;
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
let activeExecution: { id: string; stop: () => void } | undefined;
const listeners = new Set<ClientListener>();

function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel("Vortex Client");
  }
  return outputChannel;
}

function getClientState(): ClientState {
  return {
    busy: Boolean(activeExecution),
    activeRequestId: activeExecution?.id
  };
}

function emitState(): void {
  const state = getClientState();
  for (const listener of listeners) {
    listener(state);
  }
}

function beginExecution(id: string, stop: () => void): void {
  activeExecution = { id, stop };
  emitState();
}

function endExecution(id: string): void {
  if (activeExecution?.id !== id) {
    return;
  }
  activeExecution = undefined;
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

function evaluateExpression(expression: string, variables: Record<string, unknown>): unknown {
  if (!expression.trim()) {
    return "";
  }

  try {
    const fn = new Function(
      "vars",
      `with (vars) { return (${expression}); }`
    ) as (vars: Record<string, unknown>) => unknown;
    return fn(variables);
  } catch {
    return undefined;
  }
}

function resolveTemplate(input: string | undefined, variables: Record<string, unknown>): string {
  if (!input) {
    return "";
  }

  return input.replace(/\{\{([\s\S]*?)\}\}/g, (_match, expression: string) => {
    const value = evaluateExpression(expression.trim(), variables);
    return value === undefined ? "" : String(value);
  });
}

function resolvePayload(param: ClientRequestPayload): ClientRequestPayload {
  const variables = getVhtVariables(param.documentUri);
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(param.headers ?? {})) {
    headers[resolveTemplate(key, variables)] = resolveTemplate(value, variables);
  }

  return {
    ...param,
    type: normalizeMethod(param.type),
    url: resolveTemplate(param.url, variables),
    headers,
    body: resolveTemplate(param.body, variables),
    scripts: {
      pre: resolveTemplate(param.scripts?.pre ?? "", variables),
      post: resolveTemplate(param.scripts?.post ?? "", variables)
    }
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

function sendHttpRequest(param: ClientRequestPayload, channel: vscode.OutputChannel): RequestExecution {
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
        channel.appendLine(`status: ${response.statusCode ?? 0} ${response.statusMessage ?? ""}`.trim());
        channel.appendLine(`response headers: ${JSON.stringify(response.headers, null, 2)}`);
        const responseText = Buffer.concat(chunks).toString("utf8");
        if (responseText) {
          channel.appendLine("response body:");
          channel.appendLine(responseText);
        }
        resolve();
      });
    });

    request.once("connect", (response, socket, head) => {
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

async function consumeSseStream(response: Response, channel: vscode.OutputChannel): Promise<void> {
  if (!response.body) {
    return;
  }

  const decoder = new TextDecoder();
  let pending = "";
  for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
    pending += decoder.decode(chunk, { stream: true });
    let boundaryIndex = pending.indexOf("\n\n");
    while (boundaryIndex !== -1) {
      const block = pending.slice(0, boundaryIndex).trim();
      pending = pending.slice(boundaryIndex + 2);
      if (block) {
        channel.appendLine(`event: ${block}`);
      }
      boundaryIndex = pending.indexOf("\n\n");
    }
  }

  const tail = pending.trim();
  if (tail) {
    channel.appendLine(`event: ${tail}`);
  }
}

function sendSseRequest(param: ClientRequestPayload, channel: vscode.OutputChannel): RequestExecution {
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

    channel.appendLine(`status: ${response.status} ${response.statusText}`.trim());
    channel.appendLine(`response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}`);
    await consumeSseStream(response, channel);
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

function sendWebSocketRequest(param: ClientRequestPayload, channel: vscode.OutputChannel): RequestExecution {
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
      channel.appendLine("websocket: open");
      if (param.body) {
        socket.send(param.body);
        channel.appendLine(`websocket sent: ${param.body}`);
      }
    });
    socket.addEventListener("message", event => {
      channel.appendLine(`websocket message: ${String(event.data)}`);
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

function createExecution(param: ClientRequestPayload, channel: vscode.OutputChannel): RequestExecution {
  const method = normalizeMethod(param.type);
  if (method === "WEBSOCKET") {
    return sendWebSocketRequest(param, channel);
  }
  if (method === "SSE" || method === "EVENTSOURCE") {
    return sendSseRequest(param, channel);
  }
  return sendHttpRequest(param, channel);
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

export function getActiveRequestId(): string | undefined {
  return getClientState().activeRequestId;
}

export async function send(param: ClientRequestPayload): Promise<void> {
  if (activeExecution) {
    throw new Error(`Another request is already running: ${activeExecution.id}`);
  }

  const channel = getOutputChannel();
  const resolved = resolvePayload(param);
  appendRequestIntro(channel, resolved);
  appendRequestHeaders(channel, resolved.headers);
  appendRequestBody(channel, resolved.body);
  channel.show(true);

  const execution = createExecution(resolved, channel);
  beginExecution(param.id, execution.stop);

  try {
    await execution.completed;
    channel.appendLine(`[done] ${buildRequestLabel(resolved)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message !== "The operation was aborted" && message !== "Stopped by user.") {
      channel.appendLine(`[error] ${buildRequestLabel(resolved)}: ${message}`);
      void vscode.window.showErrorMessage(`Request failed: ${message}`);
    } else {
      channel.appendLine(`[stopped] ${buildRequestLabel(resolved)}`);
    }
  } finally {
    endExecution(param.id);
    appendDivider(channel);
  }
}

export async function stop(id: string): Promise<void> {
  if (!activeExecution || activeExecution.id !== id) {
    return;
  }

  activeExecution.stop();
}

export default send;
