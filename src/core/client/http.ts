import * as http from "node:http";
import { PreparedRequest, RequestExecution } from "./types";

export function executeHttpRequest(request: PreparedRequest): RequestExecution {
  if (request.method === "CONNECT") {
    return createNodeRequest(request, "CONNECT");
  }

  if (request.method === "TRACE") {
    return createNodeRequest(request, "TRACE");
  }

  return createFetchRequest(request);
}

function createFetchRequest(request: PreparedRequest): RequestExecution {
  const controller = new AbortController();

  return {
    stop: () => controller.abort(),
    promise: (async () => {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: controller.signal
      });

      return {
        id: request.id,
        status: response.status,
        ok: response.ok,
        headers: toHeadersRecord(response.headers),
        body: await readResponseBody(response, request.method)
      };
    })()
  };
}

function createNodeRequest(
  request: PreparedRequest,
  method: "CONNECT" | "TRACE"
): RequestExecution {
  const url = new URL(request.url);
  const transport = http.request({
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method,
    headers: request.headers
  });

  return {
    stop: () => transport.destroy(new Error("Stopped by user.")),
    promise: new Promise((resolve, reject) => {
      if (method === "CONNECT") {
        transport.on("connect", (response, socket) => {
          socket.end();
          resolve({
            id: request.id,
            status: response.statusCode ?? 0,
            ok: isOk(response.statusCode),
            headers: normalizeNodeHeaders(response.headers),
            body: ""
          });
        });
      } else {
        transport.on("response", response => {
          const chunks: Buffer[] = [];
          response.on("data", chunk => chunks.push(Buffer.from(chunk)));
          response.on("end", () => {
            const rawBody = Buffer.concat(chunks).toString("utf8");
            resolve({
              id: request.id,
              status: response.statusCode ?? 0,
              ok: isOk(response.statusCode),
              headers: normalizeNodeHeaders(response.headers),
              body: parseTraceBody(rawBody, String(response.headers["content-type"] ?? ""))
            });
          });
        });
      }

      transport.on("error", reject);
      transport.end();
    })
  };
}

async function readResponseBody(response: Response, method: PreparedRequest["method"]): Promise<unknown> {
  if (method === "HEAD" || response.status === 204) {
    return "";
  }

  const contentType = response.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      return await response.json();
    }

    if (contentType.includes("text/") || contentType.includes("xml")) {
      return await response.text();
    }

    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
  } catch {
    return null;
  }
}

function parseTraceBody(body: string, contentType: string): unknown {
  if (contentType.includes("application/json")) {
    return JSON.parse(body || "null");
  }

  return body;
}

function toHeadersRecord(headers: Headers): Record<string, string> {
  const output: Record<string, string> = {};
  headers.forEach((value, key) => {
    output[key] = value;
  });
  return output;
}

function normalizeNodeHeaders(headers: http.IncomingHttpHeaders): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.join(",") : String(value ?? "")
    ])
  );
}

function isOk(status?: number): boolean {
  const value = status ?? 0;
  return value >= 200 && value < 300;
}
