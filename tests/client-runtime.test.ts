import * as http from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const vscodeMocks = vi.hoisted(() => {
  return {
    showErrorMessage: vi.fn(() => Promise.resolve(undefined))
  };
});

const panelMocks = vi.hoisted(() => {
  const panel = {
    appendLine: vi.fn(),
    show: vi.fn(),
    clear: vi.fn()
  };

  return {
    panel,
    getClientPanel: vi.fn(() => panel)
  };
});

vi.mock("vscode", () => ({
  Disposable: class Disposable {
    constructor(private readonly fn: () => void) {}
    dispose(): void {
      this.fn();
    }
  },
  window: {
    showErrorMessage: vscodeMocks.showErrorMessage
  }
}));

vi.mock("../src/views/clientPanel", () => ({
  getClientPanel: panelMocks.getClientPanel
}));

function listen(server: http.Server): Promise<number> {
  return new Promise(resolve => {
    server.listen(0, "127.0.0.1", () => {
      resolve((server.address() as AddressInfo).port);
    });
  });
}

function expectTransactionFormat(lines: string[], nodeName: string): void {
  expect(lines.some(line => line.includes(nodeName) || line.includes(" HTTP/1.1"))).toBe(true);
  expect(lines.some(line => line.includes(" HTTP/1.1"))).toBe(true);
  expect(lines.some(line => line.startsWith("status: ") || line === "请求失败")).toBe(true);
}

describe("client runtime", () => {
  const servers: http.Server[] = [];

  beforeEach(() => {
    panelMocks.panel.appendLine.mockReset();
    panelMocks.panel.show.mockReset();
    panelMocks.panel.clear.mockReset();
    panelMocks.getClientPanel.mockClear();
    vscodeMocks.showErrorMessage.mockClear();
    vi.resetModules();
    delete (globalThis as { WebSocket?: unknown }).WebSocket;
  });

  afterEach(async () => {
    await Promise.all(servers.map(server => new Promise<void>(resolve => server.close(() => resolve()))));
    servers.length = 0;
    delete (globalThis as { WebSocket?: unknown }).WebSocket;
  });

  it.each(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS", "TRACE", "SUBSCRIBE", "UNSUBSCRIBE"])(
    "sends %s requests over HTTP",
    async method => {
      const seen: Array<{ method?: string; body: string }> = [];
      const server = http.createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on("data", chunk => chunks.push(Buffer.from(chunk)));
        req.on("end", () => {
          seen.push({
            method: req.method,
            body: Buffer.concat(chunks).toString("utf8")
          });
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("ok");
        });
      });
      servers.push(server);
      const port = await listen(server);
      const client = await import("../src/core/client");

      await client.send({
        id: `req_${method.toLowerCase()}`,
        type: method,
        name: method.toLowerCase(),
        url: `http://127.0.0.1:${port}/requests`,
        headers: { "Content-Type": "text/plain" },
        body: method === "GET" || method === "HEAD" ? "" : `body-${method}`
      });

      expect(seen[0]?.method).toBe(method);
      const lines = panelMocks.panel.appendLine.mock.calls.map(([line]) => String(line));
      expectTransactionFormat(lines, method.toLowerCase());
      expect(lines.some(line => line.startsWith(`${method} http://127.0.0.1:`))).toBe(true);
    }
  );

  it("returns HTTP execution details to the caller", async () => {
    const seen: Array<{ authorization?: string; body: string }> = [];
    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", chunk => chunks.push(Buffer.from(chunk)));
      req.on("end", () => {
        seen.push({
          authorization: req.headers.authorization,
          body: Buffer.concat(chunks).toString("utf8")
        });
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    servers.push(server);
    const port = await listen(server);
    const client = await import("../src/core/client");

    const result = await client.send({
      id: "req_hooked",
      type: "POST",
      name: "hooked",
      url: `http://127.0.0.1:${port}/hooked`,
      headers: {},
      body: "{\"before\":true}"
    });

    expect(seen[0]).toEqual({
      authorization: undefined,
      body: "{\"before\":true}"
    });
    expect(result.status).toBe(201);
    expect(result.body).toBe("{\"ok\":true}");
  });

  it("masks authorization header in request logs", async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{\"ok\":true}");
    });
    servers.push(server);
    const port = await listen(server);
    const client = await import("../src/core/client");

    await client.send({
      id: "req_masked",
      type: "GET",
      name: "masked",
      url: `http://127.0.0.1:${port}/masked`,
      headers: {
        Authorization: "Bearer super-secret-token"
      }
    });

    const lines = panelMocks.panel.appendLine.mock.calls.map(([line]) => String(line));
    expect(lines).toContain("authorization: Bearer ****** (masked)");
    expect(lines.some(line => line.includes("super-secret-token"))).toBe(false);
  });

  it("supports CONNECT requests", async () => {
    const server = http.createServer();
    server.on("connect", (_req, socket) => {
      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      socket.end();
    });
    servers.push(server);
    const port = await listen(server);
    const client = await import("../src/core/client");

    await client.send({
      id: "req_connect",
      type: "CONNECT",
      name: "connect",
      url: `http://127.0.0.1:${port}/tunnel`
    });

    const lines = panelMocks.panel.appendLine.mock.calls.map(([line]) => String(line));
    expectTransactionFormat(lines, "connect");
    expect(lines.some(line => line.startsWith("CONNECT http://127.0.0.1:"))).toBe(true);
  });

  it.each(["SSE", "EVENTSOURCE"])("streams %s requests and can stop them", async method => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      });
      res.write("data: hello\n\n");
    });
    servers.push(server);
    const port = await listen(server);
    const client = await import("../src/core/client");

    const sendPromise = client.send({
      id: `req_${method.toLowerCase()}`,
      type: method,
      name: method.toLowerCase(),
      url: `http://127.0.0.1:${port}/events`
    });

    await new Promise(resolve => setTimeout(resolve, 40));
    expect(client.isClientBusy()).toBe(true);
    await client.stop(`req_${method.toLowerCase()}`);
    await sendPromise;

    expect(client.isClientBusy()).toBe(false);
    const lines = panelMocks.panel.appendLine.mock.calls.map(([line]) => String(line));
    expectTransactionFormat(lines, method.toLowerCase());
    expect(lines.some(line => line.startsWith(`${method} http://127.0.0.1:`))).toBe(true);
    expect(lines).toContain("请求失败");
  });

  it("opens websocket requests and stops them", async () => {
    class FakeWebSocket {
      public readyState = 0;
      public readonly CLOSING = 2;
      public readonly CLOSED = 3;
      private readonly listeners = new Map<string, Array<(event?: any) => void>>();

      constructor(public readonly url: string) {
        setTimeout(() => {
          this.readyState = 1;
          this.emit("open");
          this.emit("message", { data: "hello" });
        }, 5);
      }

      addEventListener(type: string, listener: (event?: any) => void): void {
        const current = this.listeners.get(type) ?? [];
        current.push(listener);
        this.listeners.set(type, current);
      }

      send(data: string): void {
        this.emit("message", { data: `echo:${data}` });
      }

      close(code = 1000, reason = ""): void {
        this.readyState = this.CLOSED;
        this.emit("close", { code, reason });
      }

      private emit(type: string, event?: any): void {
        for (const listener of this.listeners.get(type) ?? []) {
          listener(event);
        }
      }
    }

    (globalThis as unknown as { WebSocket?: typeof FakeWebSocket }).WebSocket = FakeWebSocket;
    const client = await import("../src/core/client");
    const sendPromise = client.send({
      id: "req_ws",
      type: "WEBSOCKET",
      name: "socket",
      url: "ws://example.test/socket",
      body: "ping"
    });

    await new Promise(resolve => setTimeout(resolve, 30));
    expect(client.isClientBusy()).toBe(true);
    await client.stop("req_ws");
    await sendPromise;

    const lines = panelMocks.panel.appendLine.mock.calls.map(([line]) => String(line));
    expectTransactionFormat(lines, "socket");
    expect(lines).toContain("WEBSOCKET ws://example.test/socket HTTP/1.1");
    expect(lines).toContain("请求失败");
    expect(client.isClientBusy()).toBe(false);
  });

  it("rejects a second send while a request is running", async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      });
      res.write("data: hello\n\n");
    });
    servers.push(server);
    const port = await listen(server);
    const client = await import("../src/core/client");

    const first = client.send({
      id: "req_busy",
      type: "SSE",
      name: "busy",
      url: `http://127.0.0.1:${port}/events`
    });

    await new Promise(resolve => setTimeout(resolve, 40));
    await expect(client.send({
      id: "req_busy",
      type: "GET",
      name: "busy-again",
      url: `http://127.0.0.1:${port}/other`
    })).rejects.toThrow("Request is already running: req_busy");

    await client.stop("req_busy");
    await first;
  });

  it("allows different request ids to run concurrently", async () => {
    const server = http.createServer((req, res) => {
      if (req.url === "/events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive"
        });
        res.write("data: hello\n\n");
        return;
      }

      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
    });
    servers.push(server);
    const port = await listen(server);
    const client = await import("../src/core/client");

    const first = client.send({
      id: "req_busy",
      type: "SSE",
      name: "busy",
      url: `http://127.0.0.1:${port}/events`
    });

    await new Promise(resolve => setTimeout(resolve, 40));
    const second = await client.send({
      id: "req_second",
      type: "GET",
      name: "second",
      url: `http://127.0.0.1:${port}/other`
    });

    expect(second.status).toBe(200);
    expect(second.body).toBe("ok");

    await client.stop("req_busy");
    await first;
  });
});
