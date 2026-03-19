import { PreparedRequest, RequestExecution } from "./types";

interface RuntimeWebSocket {
  readonly CLOSING: number;
  readonly CLOSED: number;
  readonly readyState: number;
  addEventListener(type: string, listener: (event?: any) => void): void;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

interface RuntimeWebSocketConstructor {
  new (url: string): RuntimeWebSocket;
}

export function executeWebSocketRequest(request: PreparedRequest): RequestExecution {
  const WebSocketCtor = getWebSocketConstructor();
  const socket = new WebSocketCtor(toWebSocketUrl(request.url));
  const events: string[] = [];

  return {
    stop: () => closeSocket(socket),
    promise: new Promise((resolve, reject) => {
      let settled = false;

      socket.addEventListener("open", () => {
        if (request.body) {
          socket.send(request.body);
        }
      });

      socket.addEventListener("message", event => {
        events.push(String(event?.data ?? ""));
      });

      socket.addEventListener("error", () => {
        finish(() => reject(new Error("WebSocket connection failed.")));
      });

      socket.addEventListener("close", event => {
        finish(() => resolve({
          id: request.id,
          status: 101,
          ok: true,
          headers: {},
          body: "",
          events,
          meta: {
            closeCode: event?.code,
            closeReason: event?.reason
          }
        }));
      });

      function finish(callback: () => void): void {
        if (settled) {
          return;
        }

        settled = true;
        callback();
      }
    })
  };
}

function getWebSocketConstructor(): RuntimeWebSocketConstructor {
  const ctor = (globalThis as { WebSocket?: RuntimeWebSocketConstructor }).WebSocket;
  if (!ctor) {
    throw new Error("Global WebSocket is not available in this runtime.");
  }

  return ctor;
}

function toWebSocketUrl(input: string): string {
  const url = new URL(input);
  if (url.protocol === "http:") {
    url.protocol = "ws:";
  } else if (url.protocol === "https:") {
    url.protocol = "wss:";
  }
  return url.toString();
}

function closeSocket(socket: RuntimeWebSocket): void {
  if (socket.readyState === socket.CLOSING || socket.readyState === socket.CLOSED) {
    return;
  }

  socket.close(1000, "Stopped by user");
}
