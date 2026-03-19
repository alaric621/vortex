export type ClientHttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS"
  | "TRACE"
  | "CONNECT"
  | "SUBSCRIBE"
  | "UNSUBSCRIBE";

export type ClientMethod = ClientHttpMethod | "WEBSOCKET" | "SSE" | "EVENTSOURCE";

export interface PreparedRequest {
  id: string;
  method: ClientMethod;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface ClientResult {
  id: string;
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  body: unknown;
  events?: string[];
  meta?: Record<string, unknown>;
}

export interface RequestExecution {
  promise: Promise<ClientResult>;
  stop: () => void;
}
