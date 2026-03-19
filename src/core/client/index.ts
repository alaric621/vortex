import * as http from "node:http";
import { Collections } from "../../../typings/filesystem";
import * as vscode from "vscode";
import { vhtMockVariables } from "../../env";
import { render } from "../render";

type ClientMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS"
  | "TRACE"
  | "CONNECT";

const activeRequestIds = new Set<string>();
const stateListeners = new Set<() => void>();


/**
 * 核心请求执行器 (Node.js 专用纯净版)
 * 不需要安装任何额外包，利用 Node 18+ 内置 fetch
 */
export default async function clientHttp(
  id: string,
  config: Collections,
  variables: Record<string, unknown> = vhtMockVariables
) {
  activeRequestIds.add(id);
  emitClientState();

  try {
    const method = ((config.type || "GET").toUpperCase()) as ClientMethod;
    const safeHeaders = render(variables, config.headers || {});
    const resolvedUrl = render(variables, String(config.url || ""));

    let requestBody: any = undefined;

    if (!['GET', 'HEAD'].includes(method) && config.body) {
      if (typeof config.body === 'object') {
        requestBody = JSON.stringify(render(variables, config.body));
        if (!safeHeaders['Content-Type'] && !safeHeaders['content-type']) {
          safeHeaders['Content-Type'] = 'application/json';
        }
      } else {
        requestBody = render(variables, String(config.body));
        if (
          !safeHeaders['Content-Type']
          && !safeHeaders['content-type']
          && looksLikeJson(requestBody)
        ) {
          safeHeaders['Content-Type'] = 'application/json';
        }
      }
    }

    if (method === "CONNECT") {
      return await sendConnectRequest(id, resolvedUrl, safeHeaders);
    }

    if (method === "TRACE") {
      return await sendTraceRequest(id, resolvedUrl, safeHeaders, requestBody);
    }

    const response = await fetch(resolvedUrl, {
      method,
      headers: safeHeaders,
      body: requestBody
    });

    const contentType = response.headers.get('content-type') || '';
    let responseData: any;

    try {
      if (method === "HEAD") {
        responseData = "";
      } else if (contentType.includes('application/json')) {
        responseData = await response.json();
      } else if (contentType.includes('text/') || contentType.includes('xml')) {
        responseData = await response.text();
      } else {
        const arrayBuffer = await response.arrayBuffer();
        responseData = Buffer.from(arrayBuffer);
      }
    } catch {
      responseData = null;
    }

    return {
      id,
      status: response.status,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseData
    };
  } finally {
    activeRequestIds.delete(id);
    emitClientState();
  }
}

export function isClientBusy(): boolean {
  return activeRequestIds.size > 0;
}

export function isRequestRunning(id: string): boolean {
  return activeRequestIds.has(id);
}

export function getActiveRequestId(): string | undefined {
  return activeRequestIds.values().next().value;
}

export async function stop(id: string): Promise<void> {
  activeRequestIds.delete(id);
  emitClientState();
}

export function onDidChangeClientState(listener: () => void): vscode.Disposable {
  stateListeners.add(listener);
  return new vscode.Disposable(() => {
    stateListeners.delete(listener);
  });
}

function looksLikeJson(input: string): boolean {
  const value = input.trim();
  return (
    (value.startsWith("{") && value.endsWith("}"))
    || (value.startsWith("[") && value.endsWith("]"))
  );
}

function emitClientState(): void {
  for (const listener of stateListeners) {
    listener();
  }
}

function sendConnectRequest(
  id: string,
  urlText: string,
  headers: Record<string, string>
): Promise<{
  id: string;
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlText);
    const request = http.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: "CONNECT",
      headers
    });

    request.on("connect", (response, socket) => {
      socket.end();
      resolve({
        id,
        status: response.statusCode ?? 0,
        ok: (response.statusCode ?? 0) >= 200 && (response.statusCode ?? 0) < 300,
        headers: Object.fromEntries(
          Object.entries(response.headers).map(([key, value]) => [
            key,
            Array.isArray(value) ? value.join(",") : String(value ?? "")
          ])
        ),
        body: ""
      });
    });

    request.on("error", reject);
    request.end();
  });
}

function sendTraceRequest(
  id: string,
  urlText: string,
  headers: Record<string, string>,
  _body: string | undefined
): Promise<{
  id: string;
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  body: unknown;
}> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlText);
    const request = http.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: "TRACE",
      headers
    }, response => {
      const chunks: Buffer[] = [];
      response.on("data", chunk => chunks.push(Buffer.from(chunk)));
      response.on("end", () => {
        const rawBody = Buffer.concat(chunks).toString("utf8");
        const contentType = String(response.headers["content-type"] ?? "");
        const parsedBody = contentType.includes("application/json")
          ? JSON.parse(rawBody || "null")
          : rawBody;

        resolve({
          id,
          status: response.statusCode ?? 0,
          ok: (response.statusCode ?? 0) >= 200 && (response.statusCode ?? 0) < 300,
          headers: Object.fromEntries(
            Object.entries(response.headers).map(([key, value]) => [
              key,
              Array.isArray(value) ? value.join(",") : String(value ?? "")
            ])
          ),
          body: parsedBody
        });
      });
    });

    request.on("error", reject);
    request.end();
  });
}
