import { ClientResult, PreparedRequest } from "./types";
import { getClientPanel } from "../../views/clientPanel";

type HookConsoleLevel = "log" | "warn" | "error" | "info";

const PLACEHOLDER_EMPTY = "<empty>";

function getClientLogger() {
  return getClientPanel();
}

function formatValue(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
  }

  return String(value);
}

function formatArgs(args: unknown[]): string {
  if (args.length === 0) {
    return PLACEHOLDER_EMPTY;
  }

  return args.map(formatValue).join(" ");
}

function appendLine(value: string): void {
  const panel = getClientLogger();
  panel.appendLine(value);
}

function showPanel(): void {
  getClientLogger().show(true);
}

function formatResponseBody(body: unknown): string | undefined {
  if (body === undefined || body === null || body === "") {
    return undefined;
  }

  if (typeof body === "string") {
    return body;
  }

  if (body instanceof Buffer) {
    return `<binary ${body.length} bytes>`;
  }

  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

function formatHeaders(headers: Record<string, string>): string | undefined {
  if (!headers || Object.keys(headers).length === 0) {
    return undefined;
  }
  return JSON.stringify(headers);
}

function emitHookLine(requestId: string, level: HookConsoleLevel, message: string): void {
  appendLine(`[hook:${requestId}] [${level}] ${message}`);
  showPanel();
}

function emitRequestLine(label: string, message: string): void {
  appendLine(`[${label}] ${message}`);
  showPanel();
}

export function logRequestSend(request: PreparedRequest): void {
  emitRequestLine("send", `${request.method} ${request.url}`);
}

export function logRequestResponse(request: PreparedRequest, result: ClientResult): void {
  emitRequestLine(
    "response",
    `${request.method} ${request.url} -> ${result.status} ${result.ok ? "OK" : "ERROR"}`
  );

  const headers = formatHeaders(result.headers);
  if (headers) {
    emitRequestLine("response.headers", headers);
  }

  const body = formatResponseBody(result.body);
  if (body !== undefined) {
    emitRequestLine("response.body", body);
  }

  if (result.events && result.events.length > 0) {
    emitRequestLine("response.events", result.events.join(" | "));
  }

  if (result.meta && Object.keys(result.meta).length > 0) {
    emitRequestLine("response.meta", JSON.stringify(result.meta));
  }
}

export function logRequestError(request: PreparedRequest, error: unknown): void {
  const message = error instanceof Error ? error.message : formatValue(error);
  emitRequestLine("error", `${request.method} ${request.url} -> ${message}`);
}

type HookConsole = Pick<Console, "log" | "warn" | "error" | "info">;

export function createHookConsole(requestId: string): HookConsole {
  return {
    log: (...args: unknown[]) => emitHookLine(requestId, "log", formatArgs(args)),
    warn: (...args: unknown[]) => emitHookLine(requestId, "warn", formatArgs(args)),
    error: (...args: unknown[]) => emitHookLine(requestId, "error", formatArgs(args)),
    info: (...args: unknown[]) => emitHookLine(requestId, "info", formatArgs(args))
  };
}
