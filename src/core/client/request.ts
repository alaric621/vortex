import { Collections } from "../../../typings/filesystem";
import { vhtMockVariables } from "../../context";
import { render } from "../render";
import { ClientHttpMethod, ClientMethod, PreparedRequest } from "./types";

// 变量：HTTP_METHODS，用于存储httpmethods。
const HTTP_METHODS = new Set<ClientHttpMethod>([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
  "TRACE",
  "CONNECT",
  "SUBSCRIBE",
  "UNSUBSCRIBE"
]);

/**
 * 方法：buildPreparedRequest
 * 说明：执行 buildPreparedRequest 相关处理逻辑。
 * @param id 参数 id。
 * @param config 参数 config。
 * @param variables 参数 variables。
 * @returns 返回 PreparedRequest 类型结果。
 * 返回值示例：const result = buildPreparedRequest('demo-value', item, { token: 'abc' }); // { ok: true }
 */
export function buildPreparedRequest(
  id: string,
  config: Collections,
  variables: Record<string, unknown> = vhtMockVariables
): PreparedRequest {
  // 变量：method，用于存储方法。
  const method = normalizeMethod(config.type);
  // 变量：headers，用于存储请求头。
  const headers = render(variables, config.headers || {});

  return {
    id,
    method,
    url: render(variables, String(config.url || "")),
    headers,
    body: buildRequestBody(method, config.body, headers, variables)
  };
}

/**
 * 方法：normalizeMethod
 * 说明：执行 normalizeMethod 相关处理逻辑。
 * @param input 参数 input。
 * @returns 返回 ClientMethod 类型结果。
 * 返回值示例：const result = normalizeMethod('demo-value'); // { ok: true }
 */
function normalizeMethod(input?: string): ClientMethod {
  // 变量：method，用于存储方法。
  const method = (input || "GET").trim().toUpperCase() as ClientMethod;
  if (method === "WEBSOCKET" || method === "SSE" || method === "EVENTSOURCE") {
    return method;
  }

  return HTTP_METHODS.has(method as ClientHttpMethod) ? method : "GET";
}

/**
 * 方法：buildRequestBody
 * 说明：执行 buildRequestBody 相关处理逻辑。
 * @param method 参数 method。
 * @param body 参数 body。
 * @param headers 参数 headers。
 * @param variables 参数 variables。
 * @returns 命中时返回 string，未命中时返回 undefined。
 * 返回值示例：const result = buildRequestBody({ ... }, { ok: true }, { token: 'abc' }, { token: 'abc' }); // 'demo-value' 或 undefined
 */
function buildRequestBody(
  method: ClientMethod,
  body: unknown,
  headers: Record<string, string>,
  variables: Record<string, unknown>
): string | undefined {
  if (body === undefined || body === null || body === "" || isBodylessMethod(method)) {
    return undefined;
  }

  if (typeof body === "object") {
    ensureJsonContentType(headers);
    return JSON.stringify(render(variables, body));
  }

  // 变量：rendered，用于存储rendered。
  const rendered = render(variables, String(body));
  if (looksLikeJson(rendered)) {
    ensureJsonContentType(headers);
  }
  return rendered;
}

/**
 * 方法：isBodylessMethod
 * 说明：执行 isBodylessMethod 相关处理逻辑。
 * @param method 参数 method。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = isBodylessMethod({ ... }); // true
 */
function isBodylessMethod(method: ClientMethod): boolean {
  return method === "GET" || method === "HEAD" || method === "TRACE" || method === "CONNECT";
}

/**
 * 方法：ensureJsonContentType
 * 说明：执行 ensureJsonContentType 相关处理逻辑。
 * @param headers 参数 headers。
 * @returns 无返回值，通过副作用完成处理。
 * 返回值示例：ensureJsonContentType({ token: 'abc' }); // undefined
 */
function ensureJsonContentType(headers: Record<string, string>): void {
  if (!headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = "application/json";
  }
}

/**
 * 方法：looksLikeJson
 * 说明：执行 looksLikeJson 相关处理逻辑。
 * @param input 参数 input。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = looksLikeJson('demo-value'); // true
 */
function looksLikeJson(input: string): boolean {
  // 变量：value，用于存储value。
  const value = input.trim();
  return (
    (value.startsWith("{") && value.endsWith("}"))
    || (value.startsWith("[") && value.endsWith("]"))
  );
}
