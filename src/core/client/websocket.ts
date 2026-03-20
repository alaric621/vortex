import { PreparedRequest, RequestExecution } from "./types";

interface RuntimeWebSocket {
  readonly CLOSING: number;
  readonly CLOSED: number;
  readonly readyState: number;
  addEventListener(type: string, listener: (event?: unknown) => void): void;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

interface RuntimeWebSocketConstructor {
  new (url: string): RuntimeWebSocket;
}

interface SocketLifecycle {
  opened: boolean;
  stopped: boolean;
  settled: boolean;
}

/**
 * 方法：executeWebSocketRequest
 * 说明：执行 executeWebSocketRequest 相关处理逻辑。
 * @param request 参数 request。
 * @returns 返回 RequestExecution 类型结果。
 * 返回值示例：const result = executeWebSocketRequest(request); // { stop: () => {}, promise: Promise.resolve({ id: 'req_demo', status: 200, ok: true, headers: {}, body: '' }) }
 */
export function executeWebSocketRequest(request: PreparedRequest): RequestExecution {
  // 变量：socket，用于存储socket。
  const socket = new (getWebSocketConstructor())(toWebSocketUrl(request.url));
  // 变量：events，用于存储events。
  const events: string[] = [];
  // 变量：lifecycle，用于存储lifecycle。
  const lifecycle: SocketLifecycle = {
    opened: false,
    stopped: false,
    settled: false
  };

  return {
    stop: () => stopSocket(socket, lifecycle),
    promise: new Promise((resolve, reject) => {
      socket.addEventListener("open", () => {
        lifecycle.opened = true;
        if (request.body) {
          socket.send(request.body);
        }
      });

      socket.addEventListener("message", event => {
        events.push(String(getEventData(event)));
      });

      socket.addEventListener("error", () => {
        finish(lifecycle, () => reject(new Error("WebSocket connection failed.")));
      });

      socket.addEventListener("close", event => {
        finish(lifecycle, () => {
          if (lifecycle.stopped) {
            reject(new Error("WebSocket request stopped by user."));
            return;
          }

          if (!didCloseSuccessfully(lifecycle, event)) {
            reject(createCloseError(event));
            return;
          }

          resolve(createSuccessResult(request.id, events, event));
        });
      });
    })
  };
}

/**
 * 方法：finish
 * 说明：执行 finish 相关处理逻辑。
 * @param lifecycle 参数 lifecycle。
 * @param callback 参数 callback。
 * @returns 无返回值，通过副作用完成处理。
 * 返回值示例：finish({ ... }, () => {}); // undefined
 */
function finish(lifecycle: SocketLifecycle, callback: () => void): void {
  if (lifecycle.settled) {
    return;
  }

  lifecycle.settled = true;
  callback();
}

/**
 * 方法：createSuccessResult
 * 说明：执行 createSuccessResult 相关处理逻辑。
 * @param requestId 参数 requestId。
 * @param events 参数 events。
 * @param event 参数 event。
 * @returns 无返回值，通过副作用完成处理。
 * 返回值示例：createSuccessResult('demo-value', [], { ok: true }); // undefined
 */
function createSuccessResult(requestId: string, events: string[], event?: unknown) {
  return {
    id: requestId,
    status: 101,
    ok: true,
    headers: {},
    body: "",
    events,
    meta: {
      closeCode: getCloseCode(event),
      closeReason: getCloseReason(event)
    }
  };
}

/**
 * 方法：didCloseSuccessfully
 * 说明：执行 didCloseSuccessfully 相关处理逻辑。
 * @param lifecycle 参数 lifecycle。
 * @param event 参数 event。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = didCloseSuccessfully({ ... }, { ok: true }); // true
 */
function didCloseSuccessfully(lifecycle: SocketLifecycle, event?: unknown): boolean {
  return lifecycle.opened && getCloseCode(event) === 1000;
}

/**
 * 方法：createCloseError
 * 说明：执行 createCloseError 相关处理逻辑。
 * @param event 参数 event。
 * @returns 返回 Error 类型结果。
 * 返回值示例：const result = createCloseError({ ok: true }); // { ok: true }
 */
function createCloseError(event?: unknown): Error {
  // 变量：code，用于存储code。
  const code = getCloseCode(event);
  // 变量：reason，用于存储reason。
  const reason = getCloseReason(event);
  // 变量：suffix，用于存储suffix。
  const suffix = reason ? `: ${reason}` : "";
  return new Error(`WebSocket closed unexpectedly (${code})${suffix}`);
}

/**
 * 方法：getEventData
 * 说明：执行 getEventData 相关处理逻辑。
 * @param event 参数 event。
 * @returns 返回 unknown 类型结果。
 * 返回值示例：const result = getEventData({ ok: true }); // { ok: true }
 */
function getEventData(event: unknown): unknown {
  return (event as { data?: unknown } | undefined)?.data ?? "";
}

/**
 * 方法：getCloseCode
 * 说明：执行 getCloseCode 相关处理逻辑。
 * @param event 参数 event。
 * @returns 返回 number 类型结果。
 * 返回值示例：const count = getCloseCode({ ok: true }); // 1
 */
function getCloseCode(event: unknown): number {
  return Number((event as { code?: unknown } | undefined)?.code ?? 0);
}

/**
 * 方法：getCloseReason
 * 说明：执行 getCloseReason 相关处理逻辑。
 * @param event 参数 event。
 * @returns 返回 string 类型结果。
 * 返回值示例：const text = getCloseReason({ ok: true }); // 'demo-value'
 */
function getCloseReason(event: unknown): string {
  return String((event as { reason?: unknown } | undefined)?.reason ?? "");
}

/**
 * 方法：getWebSocketConstructor
 * 说明：执行 getWebSocketConstructor 相关处理逻辑。
 * @param 无 无参数。
 * @returns 返回 RuntimeWebSocketConstructor 类型结果。
 * 返回值示例：const result = getWebSocketConstructor(); // { ok: true }
 */
function getWebSocketConstructor(): RuntimeWebSocketConstructor {
  // 变量：ctor，用于存储ctor。
  const ctor = (globalThis as { WebSocket?: RuntimeWebSocketConstructor }).WebSocket;
  if (!ctor) {
    throw new Error("Global WebSocket is not available in this runtime.");
  }

  return ctor;
}

/**
 * 方法：toWebSocketUrl
 * 说明：执行 toWebSocketUrl 相关处理逻辑。
 * @param input 参数 input。
 * @returns 返回 string 类型结果。
 * 返回值示例：const text = toWebSocketUrl('demo-value'); // 'demo-value'
 */
function toWebSocketUrl(input: string): string {
  // 变量：url，用于存储地址。
  const url = new URL(input);
  if (url.protocol === "http:") {
    url.protocol = "ws:";
  } else if (url.protocol === "https:") {
    url.protocol = "wss:";
  }
  return url.toString();
}

/**
 * 方法：stopSocket
 * 说明：执行 stopSocket 相关处理逻辑。
 * @param socket 参数 socket。
 * @param lifecycle 参数 lifecycle。
 * @returns 无返回值，通过副作用完成处理。
 * 返回值示例：stopSocket({ ... }, { ... }); // undefined
 */
function stopSocket(socket: RuntimeWebSocket, lifecycle: SocketLifecycle): void {
  lifecycle.stopped = true;
  if (socket.readyState === socket.CLOSING || socket.readyState === socket.CLOSED) {
    return;
  }

  socket.close(1000, "Stopped by user");
}
