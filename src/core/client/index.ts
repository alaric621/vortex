import { Collections } from "../../../typings/filesystem";
import { vhtMockVariables } from "../../env";
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
import { ClientResult, RequestExecution } from "./types";
import { executeWebSocketRequest } from "./websocket";

export default async function clientHttp(
  id: string,
  config: Collections,
  variables: Record<string, unknown> = vhtMockVariables
): Promise<ClientResult> {
  if (isRequestRunning(id)) {
    throw new Error(`Request is already running: ${id}`);
  }

  const request = buildPreparedRequest(id, config, variables);
  const execution = createExecution(request);
  registerActiveRequest(id, execution.stop);

  try {
    return await execution.promise;
  } finally {
    clearActiveRequest(id);
  }
}

export { getActiveRequestId, isClientBusy, isRequestRunning, onDidChangeClientState };

export async function stop(id: string): Promise<void> {
  await stopRequest(id);
}

function createExecution(request: ReturnType<typeof buildPreparedRequest>): RequestExecution {
  if (request.method === "WEBSOCKET") {
    return executeWebSocketRequest(request);
  }

  if (request.method === "SSE" || request.method === "EVENTSOURCE") {
    return executeSseRequest(request);
  }

  return executeHttpRequest(request);
}
