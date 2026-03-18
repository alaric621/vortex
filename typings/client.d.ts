export type ProtocolKind = "http" | "ws" | "sse" | "custom";

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS"
  | "TRACE"
  | "CONNECT";

export interface ClientContext {
  traceId: string;
  requestId: string;
  startTime: number;
  metadata?: Record<string, unknown>;
}

export interface RequestOptions {
  id: string;
  url: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  timeoutMs?: number;
  retryable?: boolean;
}

export interface StandardError {
  code:
    | "NETWORK_ERROR"
    | "TIMEOUT"
    | "CANCELLED"
    | "REQUEST_ID_CONFLICT"
    | "UNAUTHORIZED"
    | "SCHEMA_VALIDATION_ERROR"
    | "CIRCUIT_OPEN"
    | "DUPLICATE_TIMEOUT_POST"
    | "UNKNOWN";
  message: string;
  status?: number;
  traceId?: string;
  raw?: unknown;
}

export interface StandardResponse<T = unknown> {
  ok: boolean;
  status: number;
  traceId: string;
  headers: Record<string, string>;
  data?: T;
  error?: StandardError;
}

export type StreamState =
  | "INITIALIZING"
  | "CONNECTED"
  | "HEARTBEATING"
  | "PENDING"
  | "RECONNECTING"
  | "CLOSING"
  | "CLOSED";

export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  shouldRetry(args: {
    attempt: number;
    method: HttpMethod;
    response?: Response;
    error?: unknown;
    retryableOverride?: boolean;
  }): boolean;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  halfOpenAfterMs: number;
}

export interface ClientConfig {
  commonHeaders: Record<string, string>;
  requestTimeoutMs: number;
  keepAliveMs: number;
  idempotencyFingerprintTtlMs: number;
  retryPolicy: RetryPolicy;
  circuitBreaker: CircuitBreakerOptions;
}

export interface RequestRuntime {
  request: RequestOptions;
  context: ClientContext;
}

export interface MiddlewareHooks {
  beforeRequest?(runtime: RequestRuntime): Promise<void> | void;
  afterResponse?(runtime: RequestRuntime, response: StandardResponse): Promise<void> | void;
  onError?(runtime: RequestRuntime, error: unknown): Promise<void> | void;
}

export interface StreamEndpoint {
  send(payload: unknown): void;
  close(code?: number, reason?: string): void;
  setHandlers(handlers: {
    onOpen?: () => void;
    onMessage?: (payload: unknown) => void;
    onError?: (error: unknown) => void;
    onClose?: (code?: number, reason?: string) => void;
  }): void;
}

export interface StreamAdapter {
  connect(url: string, protocols?: string[]): Promise<StreamEndpoint>;
}

export interface StreamManagerEvents {
  state: (state: StreamState) => void;
  message: (payload: unknown) => void;
  error: (error: unknown) => void;
}

export type ProtocolMap = Record<string, ProtocolKind>;

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitRecord {
  state: CircuitState;
  failures: number;
  openedAt?: number;
}

export interface PendingFingerprint {
  expiresAt: number;
}

export interface InflightRequest {
  controller: AbortController;
  cancelled: boolean;
}

export type Subscriber = (payload: unknown) => void;

export interface TopicRecord {
  listeners: Set<Subscriber>;
  refCount: number;
  lastOffset?: number;
}
