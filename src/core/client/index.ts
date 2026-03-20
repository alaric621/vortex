import { Collections } from "../../../typings/filesystem";
import { vhtMockVariables } from "../../context";
import { executeHttpRequest } from "./http";
import { buildPreparedRequest } from "./request";
import {
  clearActiveRequest,
  getActiveRequestId,
  isClientBusy,
  isRequestRunning,
  onDidChangeClientState,
  registerActiveRequest,
  stopRequest
} from "./state";
import { executeSseRequest } from "./sse";
import { ClientResult, ClientOptions, RequestExecution } from "./types";
import { executeWebSocketRequest } from "./websocket";
import { logRequestError, logRequestResponse, logRequestSend } from "./log";

/**
 * 方法：clientHttp
 * 说明：执行 clientHttp 相关处理逻辑。
 * @param id 参数 id。
 * @param config 参数 config。
 * @param variables 参数 variables。
 * @returns 异步返回 ClientResult 类型结果。
 * 返回值示例：const result = await clientHttp('demo-value', item, { token: 'abc' }); // { ok: true }
 */
export default async function clientHttp(
  id: string,
  config: Collections,
  variables: Record<string, unknown> = vhtMockVariables,
  options?: ClientOptions
): Promise<ClientResult> {
  if (isRequestRunning(id)) {
    throw new Error(`Request is already running: ${id}`);
  }

  // 变量：request，用于存储请求。
  const request = buildPreparedRequest(id, config, variables);
  logRequestSend(request);
  // 变量：execution，用于存储execution。
  const execution = createExecution(request, options);
  registerActiveRequest(id, execution.stop);

  try {
    const response = await execution.promise;
    logRequestResponse(request, response);
    return response;
  } catch (error) {
    logRequestError(request, error);
    throw error;
  } finally {
    clearActiveRequest(id);
  }
}

export { getActiveRequestId, isClientBusy, isRequestRunning, onDidChangeClientState };

/**
 * 方法：stop
 * 说明：执行 stop 相关处理逻辑。
 * @param id 参数 id。
 * @returns 异步完成后无返回值。
 * 返回值示例：await stop('demo-value'); // undefined
 */
export async function stop(id: string): Promise<void> {
  await stopRequest(id);
}

/**
 * 方法：createExecution
 * 说明：执行 createExecution 相关处理逻辑。
 * @param request 参数 request。
 * @returns 返回 RequestExecution 类型结果。
 * 返回值示例：const result = createExecution(request); // { stop: () => {}, promise: Promise.resolve({ id: 'req_demo', status: 200, ok: true, headers: {}, body: '' }) }
 */
function createExecution(
  request: ReturnType<typeof buildPreparedRequest>,
  options?: ClientOptions
): RequestExecution {
  if (request.method === "WEBSOCKET") {
    return executeWebSocketRequest(request, options);
  }

  if (request.method === "SSE" || request.method === "EVENTSOURCE") {
    return executeSseRequest(request, options);
  }

  return executeHttpRequest(request);
}
