import { toHeadersRecord } from "../../utils/headers";
import { PreparedRequest, RequestExecution } from "./types";

/**
 * 方法：executeSseRequest
 * 说明：执行 executeSseRequest 相关处理逻辑。
 * @param request 参数 request。
 * @returns 返回 RequestExecution 类型结果。
 * 返回值示例：const result = executeSseRequest(request); // { stop: () => {}, promise: Promise.resolve({ id: 'req_demo', status: 200, ok: true, headers: {}, body: '' }) }
 */
export function executeSseRequest(request: PreparedRequest): RequestExecution {
  // 变量：controller，用于存储controller。
  const controller = new AbortController();

  return {
    stop: () => controller.abort(),
    promise: (async () => {
      // 变量：response，用于存储响应。
      const response = await fetch(request.url, {
        method: "GET",
        headers: withSseHeaders(request.headers),
        signal: controller.signal
      });

      return {
        id: request.id,
        status: response.status,
        ok: response.ok,
        headers: toHeadersRecord(response.headers),
        body: "",
        events: await readSseEvents(response)
      };
    })()
  };
}

/**
 * 方法：withSseHeaders
 * 说明：执行 withSseHeaders 相关处理逻辑。
 * @param headers 参数 headers。
 * @returns 返回 Record<string, string> 类型结果。
 * 返回值示例：const result = withSseHeaders({ token: 'abc' }); // { ok: true }
 */
function withSseHeaders(headers: Record<string, string>): Record<string, string> {
  return {
    Accept: "text/event-stream",
    ...headers
  };
}

/**
 * 方法：readSseEvents
 * 说明：执行 readSseEvents 相关处理逻辑。
 * @param response 参数 response。
 * @returns 异步返回 string[] 类型结果。
 * 返回值示例：const result = await readSseEvents(response); // [{ id: 'demo' }]
 */
async function readSseEvents(response: Response): Promise<string[]> {
  if (!response.body) {
    return [];
  }

  // 变量：reader，用于存储reader。
  const reader = response.body.getReader();
  // 变量：decoder，用于存储decoder。
  const decoder = new TextDecoder();
  // 变量：events，用于存储events。
  const events: string[] = [];
  // 变量：pending，用于存储pending。
  let pending = "";

  while (true) {
    // 变量：chunk，用于存储chunk。
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }

    pending += decoder.decode(chunk.value, { stream: true });
    pending = flushSseBlocks(pending, events);
  }

  flushSseBlock(pending, events);
  return events;
}

/**
 * 方法：flushSseBlocks
 * 说明：执行 flushSseBlocks 相关处理逻辑。
 * @param input 参数 input。
 * @param events 参数 events。
 * @returns 返回 string 类型结果。
 * 返回值示例：const text = flushSseBlocks('demo-value', []); // 'demo-value'
 */
function flushSseBlocks(input: string, events: string[]): string {
  // 变量：pending，用于存储pending。
  let pending = normalizeSseNewlines(input);
  // 变量：boundary，用于存储boundary。
  let boundary = pending.indexOf("\n\n");

  while (boundary !== -1) {
    flushSseBlock(pending.slice(0, boundary), events);
    pending = pending.slice(boundary + 2);
    boundary = pending.indexOf("\n\n");
  }

  return pending;
}

/**
 * 方法：flushSseBlock
 * 说明：执行 flushSseBlock 相关处理逻辑。
 * @param block 参数 block。
 * @param events 参数 events。
 * @returns 无返回值，通过副作用完成处理。
 * 返回值示例：flushSseBlock('demo-value', []); // undefined
 */
function flushSseBlock(block: string, events: string[]): void {
  // 变量：lines，用于存储lines。
  const lines = normalizeSseNewlines(block)
    .split("\n")
    .map(line => line.trimEnd());

  // 变量：dataLines，用于存储数据lines。
  const dataLines = lines
    .filter(line => line.startsWith("data:"))
    .map(line => line.slice(5).trimStart());

  if (dataLines.length > 0) {
    events.push(dataLines.join("\n"));
    return;
  }

  // 变量：payload，用于存储payload。
  const payload = lines.filter(line => line && !line.startsWith(":"));
  if (payload.length > 0) {
    events.push(payload.join("\n"));
  }
}

/**
 * 方法：normalizeSseNewlines
 * 说明：执行 normalizeSseNewlines 相关处理逻辑。
 * @param value 参数 value。
 * @returns 返回 string 类型结果。
 * 返回值示例：const text = normalizeSseNewlines('demo-value'); // 'demo-value'
 */
function normalizeSseNewlines(value: string): string {
  return value.replace(/\r\n/g, "\n");
}
