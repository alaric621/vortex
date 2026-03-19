import { Collections } from "../../../typings/filesystem";
import { vhtMockVariables } from "../../env";
import { render } from "../render";
import { ClientHttpMethod, ClientMethod, PreparedRequest } from "./types";

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

export function buildPreparedRequest(
  id: string,
  config: Collections,
  variables: Record<string, unknown> = vhtMockVariables
): PreparedRequest {
  const method = normalizeMethod(config.type);
  const headers = render(variables, config.headers || {});

  return {
    id,
    method,
    url: render(variables, String(config.url || "")),
    headers,
    body: buildRequestBody(method, config.body, headers, variables)
  };
}

function normalizeMethod(input?: string): ClientMethod {
  const method = (input || "GET").trim().toUpperCase() as ClientMethod;
  if (method === "WEBSOCKET" || method === "SSE" || method === "EVENTSOURCE") {
    return method;
  }

  return HTTP_METHODS.has(method as ClientHttpMethod) ? method : "GET";
}

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

  const rendered = render(variables, String(body));
  if (looksLikeJson(rendered)) {
    ensureJsonContentType(headers);
  }
  return rendered;
}

function isBodylessMethod(method: ClientMethod): boolean {
  return method === "GET" || method === "HEAD" || method === "TRACE" || method === "CONNECT";
}

function ensureJsonContentType(headers: Record<string, string>): void {
  if (!headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = "application/json";
  }
}

function looksLikeJson(input: string): boolean {
  const value = input.trim();
  return (
    (value.startsWith("{") && value.endsWith("}"))
    || (value.startsWith("[") && value.endsWith("]"))
  );
}
