import * as http from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import clientHttp, {
  isClientBusy,
  isRequestRunning,
  onDidChangeClientState
} from "../src/core/client";

vi.mock("vscode", () => ({
  Disposable: class Disposable {
    constructor(private readonly fn: () => void) {}
    dispose(): void {
      this.fn();
    }
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
  "TRACE",
  "CONNECT"
] as const;

const BODYLESS_METHODS = new Set(["GET", "HEAD", "TRACE", "CONNECT"]);
const STATUS_CASES = [200, 201, 204, 400, 404] as const;

const METHOD_CASES = METHODS.map(method => ({
  method,
  requestId: `req_${method.toLowerCase()}`,
  headers: method === "POST" ? {} : { "X-Token": "{{client.token}}" },
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

    const disposable = onDidChangeClientState(() => {});
    expect(disposable).toMatchObject({
      dispose: expect.any(Function)
    });
    disposable.dispose();
  });
});
