import * as http from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import clientHttp, {
  getActiveRequestId,
  isClientBusy,
  isRequestRunning,
  stop,
  onDidChangeClientState
} from "../src/core/client";

vi.mock("vscode", () => ({
  Disposable: class Disposable {
    constructor(private readonly fn: () => void) {}
    dispose(): void {
      this.fn();
    }
  },
  window: {
    createOutputChannel: () => ({
      appendLine: () => undefined,
      show: () => undefined,
      clear: () => undefined
    })
  }
}));

const METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
  "SUBSCRIBE",
  "UNSUBSCRIBE",
  "TRACE",
  "CONNECT"
] as const;

const BODYLESS_METHODS = new Set(["GET", "HEAD", "TRACE", "CONNECT"]);
const STATUS_CASES = [200, 201, 204, 400, 404] as const;

const METHOD_CASES = METHODS.map(method => ({
  method,
  requestId: `req_${method.toLowerCase()}`,
  headers: (method === "POST" ? {} : { "X-Token": "{{client.token}}" }) as Record<string, string>,
  body: BODYLESS_METHODS.has(method) ? "" : method === "POST" ? "{\"name\":\"demo\"}" : "{\"env\":\"{{env}}\"}",
  expectedRequestBody: BODYLESS_METHODS.has(method)
    ? ""
    : method === "POST"
      ? "{\"name\":\"demo\"}"
      : "{\"env\":\"dev\"}",
  expectedContentType: BODYLESS_METHODS.has(method) ? undefined : "application/json",
  successStatus: method === "POST" ? 201 : 200,
  successBody: method === "CONNECT" || method === "HEAD" ? "" : { ok: true, method },
  failureBody: method === "CONNECT" || method === "HEAD" ? "" : { message: `server error ${method}` }
}));

function listen(server: http.Server): Promise<number> {
  return new Promise(resolve => {
    server.listen(0, "127.0.0.1", () => {
      resolve((server.address() as AddressInfo).port);
    });
  });
}

describe("client 请求执行", () => {
  const servers: http.Server[] = [];

  afterEach(async () => {
    await Promise.all(servers.map(server => new Promise<void>(resolve => server.close(() => resolve()))));
    servers.length = 0;
  });

  it.each(METHOD_CASES)("$method 成功请求", async testCase => {
    const seen: Array<{ method?: string; body: string; contentType?: string; url?: string }> = [];
    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", chunk => chunks.push(Buffer.from(chunk)));
      req.on("end", () => {
        seen.push({
          method: req.method,
          body: Buffer.concat(chunks).toString("utf8"),
          contentType: req.headers["content-type"],
          url: req.url
        });
        res.writeHead(testCase.successStatus, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, method: testCase.method }));
      });
    });
    server.on("connect", (req, socket) => {
      seen.push({
        method: req.method,
        body: "",
        contentType: req.headers["content-type"] as string | undefined,
        url: req.url
      });
      socket.write("HTTP/1.1 200 Connection Established\r\nX-Test: connect\r\n\r\n");
      socket.end();
    });
    servers.push(server);
    const port = await listen(server);

    const result = await clientHttp(testCase.requestId, {
      id: testCase.requestId,
      type: testCase.method,
      name: testCase.method.toLowerCase(),
      folder: "/",
      url: `http://127.0.0.1:${port}/{{name}}`,
      headers: testCase.headers,
      body: testCase.body
    });

    expect(seen[0]?.method).toBe(testCase.method);
    expect(seen[0]?.url).toBe("/demo-user");
    expect(seen[0]?.body).toBe(testCase.expectedRequestBody);
    expect(seen[0]?.contentType).toBe(testCase.expectedContentType);

    expect(result).toMatchObject({
      id: testCase.requestId,
      status: testCase.successStatus,
      ok: true,
      body: testCase.successBody
    });
  });

  it.each(METHOD_CASES)("$method 失败请求返回", async testCase => {
    const server = http.createServer((_req, res) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: `server error ${testCase.method}` }));
    });
    server.on("connect", (_req, socket) => {
      socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
      socket.end();
    });
    servers.push(server);
    const port = await listen(server);

    const result = await clientHttp(`req_fail_${testCase.method.toLowerCase()}`, {
      id: `req_fail_${testCase.method.toLowerCase()}`,
      type: testCase.method,
      name: `fail-${testCase.method.toLowerCase()}`,
      folder: "/",
      url: `http://127.0.0.1:${port}/fail`,
      headers: {},
      body: BODYLESS_METHODS.has(testCase.method) ? "" : "{\"env\":\"{{env}}\"}"
    });

    expect(result).toMatchObject({
      id: `req_fail_${testCase.method.toLowerCase()}`,
      status: 500,
      ok: false,
      body: testCase.failureBody
    });
  });

  it.each(METHOD_CASES)("$method 多种状态码返回", async testCase => {
    for (const status of STATUS_CASES) {
      const server = http.createServer((_req, res) => {
        res.writeHead(status, { "Content-Type": "text/plain" });
        res.end(status === 204 ? "" : `status-${status}`);
      });
      server.on("connect", (_req, socket) => {
        socket.write(`HTTP/1.1 ${status} test\r\n\r\n`);
        socket.end();
      });
      servers.push(server);
      const port = await listen(server);

      const result = await clientHttp(`req_${testCase.method.toLowerCase()}_${status}`, {
        id: `req_${testCase.method.toLowerCase()}_${status}`,
        type: testCase.method,
        name: `${testCase.method.toLowerCase()}-${status}`,
        folder: "/",
        url: `http://127.0.0.1:${port}/status/${status}`,
        headers: {},
        body: BODYLESS_METHODS.has(testCase.method) ? "" : "payload"
      });

      expect(result.id).toBe(`req_${testCase.method.toLowerCase()}_${status}`);
      expect(result.status).toBe(status);
      expect(result.ok).toBe(status >= 200 && status < 300);

      const expectedBody = testCase.method === "CONNECT" || testCase.method === "HEAD" || status === 204
        ? ""
        : `status-${status}`;
      expect(result.body).toBe(expectedBody);
    }
  });

  it("占位状态导出应该仍然可调用", () => {
    expect(isClientBusy()).toBe(false);
    expect(isRequestRunning("req_any")).toBe(false);
    expect(getActiveRequestId()).toBeUndefined();

    const disposable = onDidChangeClientState(() => {});
    expect(disposable).toMatchObject({
      dispose: expect.any(Function)
    });
    disposable.dispose();
  });

  it("supports websocket requests", async () => {
    class MockWebSocket {
      public static readonly OPEN = 1;
      public readonly CLOSING = 2;
      public readonly CLOSED = 3;
      public readyState = MockWebSocket.OPEN;
      private readonly listeners = new Map<string, Array<(event?: any) => void>>();

      constructor(public readonly url: string) {
        setTimeout(() => this.emit("open"), 0);
        setTimeout(() => this.emit("message", { data: "first" }), 5);
        setTimeout(() => this.close(1000, "done"), 10);
      }

      addEventListener(type: string, listener: (event?: any) => void): void {
        const handlers = this.listeners.get(type) ?? [];
        handlers.push(listener);
        this.listeners.set(type, handlers);
      }

      send(_data: string): void {}

      close(code = 1000, reason = "closed"): void {
        this.readyState = this.CLOSED;
        this.emit("close", { code, reason });
      }

      private emit(type: string, event?: any): void {
        for (const listener of this.listeners.get(type) ?? []) {
          listener(event);
        }
      }
    }

    const runtimeGlobal = globalThis as unknown as { WebSocket?: typeof MockWebSocket };
    const previousWebSocket = runtimeGlobal.WebSocket;
    runtimeGlobal.WebSocket = MockWebSocket;

    try {
      const result = await clientHttp("req_ws", {
        id: "req_ws",
        type: "WEBSOCKET",
        name: "ws",
        folder: "/",
        url: "http://example.test/socket",
        headers: {},
        body: "{\"ping\":true}"
      });

      expect(result).toMatchObject({
        id: "req_ws",
        status: 101,
        ok: true,
        body: "",
        events: ["first"]
      });
    } finally {
      runtimeGlobal.WebSocket = previousWebSocket;
    }
  });

  it("reports websocket events via onEvent callback", async () => {
    class EventWebSocket {
      public static readonly OPEN = 1;
      public readonly CLOSING = 2;
      public readonly CLOSED = 3;
      public readyState = EventWebSocket.OPEN;
      private readonly listeners = new Map<string, Array<(event?: any) => void>>();

      constructor(public readonly url: string) {
        setTimeout(() => this.emit("open"), 0);
        setTimeout(() => this.emit("message", { data: "ping" }), 5);
        setTimeout(() => this.close(1000, "done"), 10);
      }

      addEventListener(type: string, listener: (event?: any) => void): void {
        const handlers = this.listeners.get(type) ?? [];
        handlers.push(listener);
        this.listeners.set(type, handlers);
      }

      send(_data: string): void {}

      close(code = 1000, reason = "closed"): void {
        this.readyState = this.CLOSED;
        this.emit("close", { code, reason });
      }

      private emit(type: string, event?: any): void {
        for (const listener of this.listeners.get(type) ?? []) {
          listener(event);
        }
      }
    }

    const runtimeGlobal = globalThis as unknown as { WebSocket?: typeof EventWebSocket };
    const previousWebSocket = runtimeGlobal.WebSocket;
    runtimeGlobal.WebSocket = EventWebSocket;

    try {
      const seen: string[] = [];
      await clientHttp(
        "req_ws_hook",
        {
          id: "req_ws_hook",
          type: "WEBSOCKET",
          name: "ws-hook",
          folder: "/",
          url: "http://example.test/socket",
          headers: {},
          body: ""
        },
        undefined,
        {
          onEvent(event) {
            seen.push(String(event.events?.[0] ?? ""));
          }
        }
      );

      expect(seen).toEqual(["ping"]);
    } finally {
      runtimeGlobal.WebSocket = previousWebSocket;
    }
  });

  it("rejects websocket requests that close abnormally", async () => {
    class FailingWebSocket {
      public static readonly OPEN = 1;
      public readonly CLOSING = 2;
      public readonly CLOSED = 3;
      public readyState = FailingWebSocket.OPEN;
      private readonly listeners = new Map<string, Array<(event?: any) => void>>();

      constructor(_url: string) {
        setTimeout(() => this.emit("open"), 0);
        setTimeout(() => this.close(1011, "server error"), 5);
      }

      addEventListener(type: string, listener: (event?: any) => void): void {
        const handlers = this.listeners.get(type) ?? [];
        handlers.push(listener);
        this.listeners.set(type, handlers);
      }

      send(_data: string): void {}

      close(code = 1000, reason = "closed"): void {
        this.readyState = this.CLOSED;
        this.emit("close", { code, reason });
      }

      private emit(type: string, event?: any): void {
        for (const listener of this.listeners.get(type) ?? []) {
          listener(event);
        }
      }
    }

    const runtimeGlobal = globalThis as unknown as { WebSocket?: typeof FailingWebSocket };
    const previousWebSocket = runtimeGlobal.WebSocket;
    runtimeGlobal.WebSocket = FailingWebSocket;

    try {
      await expect(clientHttp("req_ws_fail", {
        id: "req_ws_fail",
        type: "WEBSOCKET",
        name: "ws-fail",
        folder: "/",
        url: "http://example.test/socket",
        headers: {},
        body: ""
      })).rejects.toThrow("WebSocket closed unexpectedly (1011): server error");
    } finally {
      runtimeGlobal.WebSocket = previousWebSocket;
    }
  });

  it("rejects websocket requests when stopped by user", async () => {
    class StoppableWebSocket {
      public static readonly OPEN = 1;
      public readonly CLOSING = 2;
      public readonly CLOSED = 3;
      public readyState = StoppableWebSocket.OPEN;
      private readonly listeners = new Map<string, Array<(event?: any) => void>>();

      constructor(_url: string) {
        setTimeout(() => this.emit("open"), 0);
      }

      addEventListener(type: string, listener: (event?: any) => void): void {
        const handlers = this.listeners.get(type) ?? [];
        handlers.push(listener);
        this.listeners.set(type, handlers);
      }

      send(_data: string): void {}

      close(code = 1000, reason = "closed"): void {
        this.readyState = this.CLOSED;
        this.emit("close", { code, reason });
      }

      private emit(type: string, event?: any): void {
        for (const listener of this.listeners.get(type) ?? []) {
          listener(event);
        }
      }
    }

    const runtimeGlobal = globalThis as unknown as { WebSocket?: typeof StoppableWebSocket };
    const previousWebSocket = runtimeGlobal.WebSocket;
    runtimeGlobal.WebSocket = StoppableWebSocket;

    try {
      const pending = clientHttp("req_ws_stop", {
        id: "req_ws_stop",
        type: "WEBSOCKET",
        name: "ws-stop",
        folder: "/",
        url: "http://example.test/socket",
        headers: {},
        body: ""
      });

      await stop("req_ws_stop");

      await expect(pending).rejects.toThrow("WebSocket request stopped by user.");
    } finally {
      runtimeGlobal.WebSocket = previousWebSocket;
    }
  });

  it.each(["SSE", "EVENTSOURCE"] as const)("supports %s streaming requests", async method => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.write("event: message\n");
      res.write("data: first\n\n");
      res.write("data: second\n\n");
      res.end();
    });
    servers.push(server);
    const port = await listen(server);

    const result = await clientHttp(`req_${method.toLowerCase()}`, {
      id: `req_${method.toLowerCase()}`,
      type: method,
      name: method.toLowerCase(),
      folder: "/",
      url: `http://127.0.0.1:${port}/events`,
      headers: {},
      body: ""
    });

    expect(result).toMatchObject({
      status: 200,
      ok: true,
      body: "",
      events: ["first", "second"]
    });
  });

  it("supports multiline SSE events with CRLF separators", async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.write(": keep-alive\r\n");
      res.write("data: first line\r\n");
      res.write("data: second line\r\n\r\n");
      res.end();
    });
    servers.push(server);
    const port = await listen(server);

    const result = await clientHttp("req_sse_multiline", {
      id: "req_sse_multiline",
      type: "SSE",
      name: "sse-multiline",
      folder: "/",
      url: `http://127.0.0.1:${port}/events`,
      headers: {},
      body: ""
    });

    expect(result).toMatchObject({
      status: 200,
      ok: true,
      events: ["first line\nsecond line"]
    });
  });

  it("notifies onEvent for each SSE message", async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.write("data: first\n\n");
      res.write("data: second\n\n");
      res.end();
    });
    servers.push(server);
    const port = await listen(server);

    const seen: string[] = [];
    const result = await clientHttp(
      "req_sse_event",
      {
        id: "req_sse_event",
        type: "SSE",
        name: "sse-event",
        folder: "/",
        url: `http://127.0.0.1:${port}/events`,
        headers: {},
        body: ""
      },
      undefined,
      {
        onEvent(event) {
          seen.push(String(event.events?.[0] ?? ""));
        }
      }
    );

    expect(seen).toEqual(["first", "second"]);
    expect(result.events).toEqual(["first", "second"]);
  });

  it("stops inflight requests through registered stop handlers", async () => {
    const server = http.createServer((_req, res) => {
      setTimeout(() => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      }, 200);
    });
    servers.push(server);
    const port = await listen(server);

    const pending = clientHttp("req_stop", {
      id: "req_stop",
      type: "GET",
      name: "stop",
      folder: "/",
      url: `http://127.0.0.1:${port}/slow`,
      headers: {},
      body: ""
    });

    expect(isRequestRunning("req_stop")).toBe(true);
    expect(getActiveRequestId()).toBe("req_stop");

    await stop("req_stop");

    await expect(pending).rejects.toThrow();
    expect(isRequestRunning("req_stop")).toBe(false);
  });
});
