import * as http from "node:http";
import * as https from "node:https";
import { toHeadersRecord } from "../../utils/headers";
import { PreparedRequest, RequestExecution } from "./types";

// 变量：REQUEST_TIMEOUT_MS，用于存储请求timeoutms。
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * 方法：executeHttpRequest
 * 说明：执行 executeHttpRequest 相关处理逻辑。
 * @param request 参数 request。
 * @returns 返回 RequestExecution 类型结果。
 * 返回值示例：const result = executeHttpRequest(request); // { stop: () => {}, promise: Promise.resolve({ id: 'req_demo', status: 200, ok: true, headers: {}, body: '' }) }
 */
export function executeHttpRequest(request: PreparedRequest): RequestExecution {
  if (request.method === "CONNECT" || request.method === "TRACE") {
    return createNodeRequest(request, request.method);
  }

  return createFetchRequest(request);
}

/**
 * 方法：createFetchRequest
 * 说明：执行 createFetchRequest 相关处理逻辑。
 * @param request 参数 request。
 * @returns 返回 RequestExecution 类型结果。
 * 返回值示例：const result = createFetchRequest(request); // { stop: () => {}, promise: Promise.resolve({ id: 'req_demo', status: 200, ok: true, headers: {}, body: '' }) }
 */
function createFetchRequest(request: PreparedRequest): RequestExecution {
  // 变量：controller，用于存储controller。
  const controller = new AbortController();
  // 变量：timeout，用于存储timeout。
  const timeout = setTimeout(() => controller.abort(new Error("Request timed out.")), REQUEST_TIMEOUT_MS);

  return {
    stop: () => controller.abort(new Error("Stopped by user.")),
    promise: (async () => {
      try {
        // 变量：response，用于存储响应。
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
      } finally {
        clearTimeout(timeout);
      }
    })()
  };
}

/**
 * 方法：createNodeRequest
 * 说明：执行 createNodeRequest 相关处理逻辑。
 * @param request 参数 request。
 * @param method 参数 method。
 * @returns 返回 RequestExecution 类型结果。
 * 返回值示例：const result = createNodeRequest(request, 'CONNECT'); // { stop: () => {}, promise: Promise.resolve({ id: 'req_demo', status: 200, ok: true, headers: {}, body: '' }) }
 */
function createNodeRequest(request: PreparedRequest, method: "CONNECT" | "TRACE"): RequestExecution {
  // 变量：url，用于存储地址。
  const url = new URL(request.url);
  // 变量：transport，用于存储transport。
  const transport = getNodeTransport(url).request({
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method,
    headers: request.headers
  });

  transport.setTimeout(REQUEST_TIMEOUT_MS, () => {
    transport.destroy(new Error("Request timed out."));
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
          collectNodeResponse(response, rawBody => {
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

/**
 * 方法：collectNodeResponse
 * 说明：执行 collectNodeResponse 相关处理逻辑。
 * @param response 参数 response。
 * @param done 参数 done。
 * @returns 无返回值，通过副作用完成处理。
 * 返回值示例：collectNodeResponse(response, () => {}); // undefined
 */
function collectNodeResponse(response: http.IncomingMessage, done: (body: string) => void): void {
  // 变量：chunks，用于存储chunks。
  const chunks: Buffer[] = [];
  response.on("data", chunk => chunks.push(Buffer.from(chunk)));
  response.on("end", () => {
    done(Buffer.concat(chunks).toString("utf8"));
  });
}

/**
 * 方法：getNodeTransport
 * 说明：执行 getNodeTransport 相关处理逻辑。
 * @param url 参数 url。
 * @returns 返回 typeof http | typeof https 类型结果。
 * 返回值示例：const result = getNodeTransport({ ... }); // { ok: true }
 */
function getNodeTransport(url: URL): typeof http | typeof https {
  return url.protocol === "https:" ? https : http;
}

/**
 * 方法：readResponseBody
 * 说明：执行 readResponseBody 相关处理逻辑。
 * @param response 参数 response。
 * @param method 参数 method。
 * @returns 异步返回 unknown 类型结果。
 * 返回值示例：const result = await readResponseBody(response, { ... }); // { ok: true }
 */
async function readResponseBody(response: Response, method: PreparedRequest["method"]): Promise<unknown> {
  if (method === "HEAD" || response.status === 204) {
    return "";
  }

  // 变量：contentType，用于存储内容类型。
  const contentType = response.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      return await response.json();
    }

    if (contentType.includes("text/") || contentType.includes("xml")) {
      return await response.text();
    }

    // 变量：buffer，用于存储buffer。
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
  } catch {
    return null;
  }
}

/**
 * 方法：parseTraceBody
 * 说明：执行 parseTraceBody 相关处理逻辑。
 * @param body 参数 body。
 * @param contentType 参数 contentType。
 * @returns 返回 unknown 类型结果。
 * 返回值示例：const result = parseTraceBody('demo-value', 'demo-value'); // { ok: true }
 */
function parseTraceBody(body: string, contentType: string): unknown {
  if (!contentType.includes("application/json")) {
    return body;
  }

  try {
    return JSON.parse(body || "null");
  } catch {
    return body;
  }
}

/**
 * 方法：normalizeNodeHeaders
 * 说明：执行 normalizeNodeHeaders 相关处理逻辑。
 * @param headers 参数 headers。
 * @returns 返回 Record<string, string> 类型结果。
 * 返回值示例：const result = normalizeNodeHeaders({ ... }); // { ok: true }
 */
function normalizeNodeHeaders(headers: http.IncomingHttpHeaders): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.join(",") : String(value ?? "")
    ])
  );
}

/**
 * 方法：isOk
 * 说明：执行 isOk 相关处理逻辑。
 * @param status 参数 status。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = isOk(1); // true
 */
function isOk(status?: number): boolean {
  // 变量：value，用于存储value。
  const value = status ?? 0;
  return value >= 200 && value < 300;
}
