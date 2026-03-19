import * as vscode from "vscode";

type StopHandler = () => void;

const activeRequests = new Map<string, StopHandler>();
const listeners = new Set<() => void>();

export function registerActiveRequest(id: string, stop: StopHandler): void {
  activeRequests.set(id, stop);
  emitStateChange();
}

export function clearActiveRequest(id: string): void {
  if (!activeRequests.delete(id)) {
    return;
  }

  emitStateChange();
}

export function isClientBusy(): boolean {
  return activeRequests.size > 0;
}

export function isRequestRunning(id: string): boolean {
  return activeRequests.has(id);
}

export function getActiveRequestId(): string | undefined {
  return activeRequests.keys().next().value;
}

export async function stopRequest(id: string): Promise<void> {
  const stop = activeRequests.get(id);
  if (!stop) {
    return;
  }

  stop();
}

export function onDidChangeClientState(listener: () => void): vscode.Disposable {
  listeners.add(listener);
  return new vscode.Disposable(() => {
    listeners.delete(listener);
  });
}

function emitStateChange(): void {
  for (const listener of listeners) {
    listener();
  }
}
