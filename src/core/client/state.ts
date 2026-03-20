import * as vscode from "vscode";

type StopHandler = () => void;

// 变量：activeRequests，用于存储activerequests。
const activeRequests = new Map<string, StopHandler>();
// 变量：listeners，用于存储listeners。
const listeners = new Set<() => void>();

/**
 * 方法：registerActiveRequest
 * 说明：执行 registerActiveRequest 相关处理逻辑。
 * @param id 参数 id。
 * @param stop 参数 stop。
 * @returns 无返回值，通过副作用完成处理。
 * 返回值示例：registerActiveRequest('demo-value', { ... }); // undefined
 */
export function registerActiveRequest(id: string, stop: StopHandler): void {
  activeRequests.set(id, stop);
  emitStateChange();
}

/**
 * 方法：clearActiveRequest
 * 说明：执行 clearActiveRequest 相关处理逻辑。
 * @param id 参数 id。
 * @returns 无返回值，通过副作用完成处理。
 * 返回值示例：clearActiveRequest('demo-value'); // undefined
 */
export function clearActiveRequest(id: string): void {
  if (!activeRequests.delete(id)) {
    return;
  }

  emitStateChange();
}

/**
 * 方法：isClientBusy
 * 说明：执行 isClientBusy 相关处理逻辑。
 * @param 无 无参数。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = isClientBusy(); // true
 */
export function isClientBusy(): boolean {
  return activeRequests.size > 0;
}

/**
 * 方法：isRequestRunning
 * 说明：执行 isRequestRunning 相关处理逻辑。
 * @param id 参数 id。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = isRequestRunning('demo-value'); // true
 */
export function isRequestRunning(id: string): boolean {
  return activeRequests.has(id);
}

/**
 * 方法：getActiveRequestId
 * 说明：执行 getActiveRequestId 相关处理逻辑。
 * @param 无 无参数。
 * @returns 命中时返回 string，未命中时返回 undefined。
 * 返回值示例：const result = getActiveRequestId(); // 'demo-value' 或 undefined
 */
export function getActiveRequestId(): string | undefined {
  return activeRequests.keys().next().value;
}

/**
 * 方法：stopRequest
 * 说明：执行 stopRequest 相关处理逻辑。
 * @param id 参数 id。
 * @returns 异步完成后无返回值。
 * 返回值示例：await stopRequest('demo-value'); // undefined
 */
export async function stopRequest(id: string): Promise<void> {
  // 变量：stop，用于存储stop。
  const stop = activeRequests.get(id);
  if (!stop) {
    return;
  }

  stop();
}

/**
 * 方法：onDidChangeClientState
 * 说明：执行 onDidChangeClientState 相关处理逻辑。
 * @param listener 参数 listener。
 * @returns 返回 vscode.Disposable 类型结果。
 * 返回值示例：const result = onDidChangeClientState(() => {}); // { ok: true }
 */
export function onDidChangeClientState(listener: () => void): vscode.Disposable {
  listeners.add(listener);
  return new vscode.Disposable(() => {
    listeners.delete(listener);
  });
}

/**
 * 方法：emitStateChange
 * 说明：执行 emitStateChange 相关处理逻辑。
 * @param 无 无参数。
 * @returns 无返回值，通过副作用完成处理。
 * 返回值示例：emitStateChange(); // undefined
 */
function emitStateChange(): void {
  for (const listener of listeners) {
    listener();
  }
}
