import * as vscode from "vscode";
import { ClientRunResult, getActiveRequestId, getClientOutputChannel, isRequestRunning, send, stop } from "../core/client";
import { resolveHookRequest, runHook } from "../core/runHook";
import { collections, createItem, getFileContent, getPathType } from "../core/filesystem/context";
import { basenamePath, dirnamePath, ensureRequestPathWithoutExtension, joinPath, normalizePath } from "../core/filesystem/path-utils";

interface Refreshable {
  refresh(): void;
}

interface WritableFileSystemProvider {
  delete(uri: vscode.Uri, options: { recursive: boolean }): void;
  rename(oldUri: vscode.Uri, newUri: vscode.Uri): void;
}

function isRequestUri(uri: vscode.Uri | undefined): uri is vscode.Uri {
  return Boolean(uri && uri.path.endsWith(".vht"));
}

function toRequestUri(uri: vscode.Uri): vscode.Uri {
  if (uri.path.endsWith(".vht")) {
    return uri;
  }
  return uri.with({ path: `${uri.path}.vht` });
}

function toEntityUri(uri: vscode.Uri): vscode.Uri {
  if (!uri.path.endsWith(".vht")) {
    return uri;
  }
  return uri.with({ path: ensureRequestPathWithoutExtension(uri.path) });
}

function getFocusedRequestUri(): vscode.Uri | undefined {
  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (!activeUri || activeUri.scheme !== "vortex-fs" || !activeUri.path.endsWith(".vht")) {
    return undefined;
  }
  return activeUri;
}

function getResourceUri(target?: vscode.TreeItem): vscode.Uri | undefined {
  return target?.resourceUri ?? getFocusedRequestUri();
}

async function saveRequestIfDirty(resourceUri: vscode.Uri): Promise<boolean> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return true;
  }

  if (editor.document.uri.toString() !== resourceUri.toString()) {
    return true;
  }

  if (!editor.document.isDirty) {
    return true;
  }

  return editor.document.save();
}

function getParentFolderPath(uri: vscode.Uri): string {
  const entityPath = ensureRequestPathWithoutExtension(uri.path);
  return isRequestUri(uri) ? dirnamePath(entityPath) : normalizePath(entityPath);
}

function buildUri(scheme: string, authority: string, path: string): vscode.Uri {
  return vscode.Uri.from({
    scheme,
    authority,
    path: normalizePath(path)
  });
}

async function createNode(
  scheme: string,
  authority: string,
  explorerProvider: Refreshable,
  target?: vscode.TreeItem
): Promise<void> {
  const baseUri = getResourceUri(target);
  const basePath = baseUri ? getParentFolderPath(baseUri) : "/";
  const input = await vscode.window.showInputBox({
    prompt: "输入请求名或目录名，目录请以 / 结尾",
    placeHolder: "例如: users/list 或 archive/"
  });

  if (!input) {
    return;
  }

  const trimmed = input.trim();
  const isDir = trimmed.endsWith("/");
  const targetPath = joinPath(basePath, isDir ? trimmed.slice(0, -1) : trimmed);

  if (!trimmed || getPathType(collections, targetPath)) {
    vscode.window.showWarningMessage(`目标已存在: ${targetPath}`);
    return;
  }

  createItem(collections, targetPath, isDir);
  explorerProvider.refresh();

  if (!isDir) {
    await vscode.commands.executeCommand("vscode.open", toRequestUri(buildUri(scheme, authority, targetPath)));
  }
}

async function renameNodeCommand(
  fsProvider: WritableFileSystemProvider,
  target?: vscode.TreeItem
): Promise<void> {
  const resourceUri = getResourceUri(target);
  if (!resourceUri) {
    return;
  }

  const oldUri = toEntityUri(resourceUri);
  const currentPath = ensureRequestPathWithoutExtension(oldUri.path);
  const newName = await vscode.window.showInputBox({
    prompt: "输入新的名称",
    value: basenamePath(currentPath)
  });

  if (!newName || !newName.trim()) {
    return;
  }

  const nextPath = joinPath(dirnamePath(currentPath), newName.trim());
  const existingType = getPathType(collections, nextPath);
  if (existingType && normalizePath(nextPath) !== normalizePath(currentPath)) {
    vscode.window.showWarningMessage(`目标已存在: ${nextPath}`);
    return;
  }

  fsProvider.rename(oldUri, buildUri(oldUri.scheme, oldUri.authority, nextPath));

  if (isRequestUri(resourceUri)) {
    await vscode.commands.executeCommand("vscode.open", toRequestUri(buildUri(oldUri.scheme, oldUri.authority, nextPath)));
  }
}

async function deleteNodeCommand(
  fsProvider: WritableFileSystemProvider,
  target?: vscode.TreeItem
): Promise<void> {
  const resourceUri = getResourceUri(target);
  if (!resourceUri) {
    return;
  }

  const targetUri = toEntityUri(resourceUri);
  const confirmed = await vscode.window.showWarningMessage(
    `确认删除 ${basenamePath(targetUri.path) || "/"} 吗？`,
    { modal: true },
    "Delete"
  );

  if (confirmed !== "Delete") {
    return;
  }

  fsProvider.delete(targetUri, { recursive: true });
}

async function sendRequestCommand(target?: vscode.TreeItem): Promise<void> {
  const resourceUri = getResourceUri(target);
  if (!resourceUri) {
    return;
  }

  if (!await saveRequestIfDirty(resourceUri)) {
    vscode.window.showWarningMessage("Failed to save the current request before sending.");
    return;
  }

  const requestPath = ensureRequestPathWithoutExtension(resourceUri.path);
  const request = getFileContent(collections, requestPath);
  if (!request) {
    vscode.window.showWarningMessage(`未找到请求: ${requestPath}`);
    return;
  }

  if (isRequestRunning(request.id)) {
    vscode.window.showWarningMessage(`Request is already running: ${request.id}`);
    return;
  }

  const resolvedRequest = resolveHookRequest({
    ...request,
    id: request.id,
    documentUri: resourceUri
  });
  const output = getClientOutputChannel();
  const response: ClientRunResult = {
    events: []
  };
  const hookContext = {
    request: resolvedRequest,
    response,
    variables: {
      request: resolvedRequest,
      response
    },
    log: (message: string) => {
      output.appendLine(message);
      output.show(true);
    }
  };

  try {
    await runHook(resolvedRequest.scripts?.pre, hookContext);
    const result = await send(resolvedRequest);
    Object.assign(response, result);
    await runHook(resolvedRequest.scripts?.post, hookContext);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    response.error = message;
    try {
      await runHook(resolvedRequest.scripts?.post, hookContext);
    } catch (hookError) {
      const hookMessage = hookError instanceof Error ? hookError.message : String(hookError);
      output.appendLine(`[hook-error] ${hookMessage}`);
      output.show(true);
    }
    vscode.window.showWarningMessage(message);
  }
}

async function stopRequestCommand(target?: vscode.TreeItem): Promise<void> {
  const resourceUri = getResourceUri(target);
  const fallbackRequestId = getActiveRequestId();
  if (!resourceUri && !fallbackRequestId) {
    return;
  }

  if (resourceUri) {
    const requestPath = ensureRequestPathWithoutExtension(resourceUri.path);
    const request = getFileContent(collections, requestPath);
    if (!request?.id) {
      vscode.window.showWarningMessage(`未找到请求: ${requestPath}`);
    } else if (isRequestRunning(request.id)) {
      await stop(request.id);
      return;
    }
  }

  if (fallbackRequestId) {
    await stop(fallbackRequestId);
  }
}

export function registerExploreCommands(
  scheme: string,
  authority: string,
  fsProvider: WritableFileSystemProvider,
  explorerProvider: Refreshable
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand("vortex.request.create", (target?: vscode.TreeItem) =>
      createNode(scheme, authority, explorerProvider, target)
    ),
    vscode.commands.registerCommand("vortex.request.rename", (target?: vscode.TreeItem) =>
      renameNodeCommand(fsProvider, target)
    ),
    vscode.commands.registerCommand("vortex.request.delete", (target?: vscode.TreeItem) =>
      deleteNodeCommand(fsProvider, target)
    ),
    vscode.commands.registerCommand("vortex.request.send", (target?: vscode.TreeItem) =>
      sendRequestCommand(target)
    ),
    vscode.commands.registerCommand("vortex.request.stop", (target?: vscode.TreeItem) =>
      stopRequestCommand(target)
    )
  ];
}
