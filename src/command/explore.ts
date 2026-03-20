import * as vscode from "vscode";
import clientHttp, { getActiveRequestId, isRequestRunning, stop } from "../core/client";
import { collections, createItem, getPathType } from "../core/filesystem/store";
import {
  basenamePath,
  dirnamePath,
  ensureRequestPathWithoutExtension,
  joinPath
} from "../utils/path";
import { runHookStrict } from "../core/runHook";
import { prepareRuntimeVariables } from "../core/runtimeVariables";
import { setRuntimeVhtVariables } from "../context";
import { buildUri, getParentFolderPath, getResourceUri, isRequestUri, toEntityUri } from "../utils/requestUri";
import {
  buildCreationTarget,
  canRenameToPath,
  getRequiredRequest,
  openRequest,
  saveActiveRequestIfDirty,
  showWarning,
  RequestSnapshot
} from "../utils/explore";

interface Refreshable {
  refresh(): void;
}

interface WritableFileSystemProvider {
  delete(uri: vscode.Uri, options: { recursive: boolean }): void;
  rename(oldUri: vscode.Uri, newUri: vscode.Uri): void;
}

/**
 * 方法：registerExploreCommands
 * 说明：注册资源树相关命令，并返回统一可释放的订阅列表。
 * @param scheme 参数 scheme。
 * @param authority 参数 authority。
 * @param fsProvider 参数 fsProvider。
 * @param explorerProvider 参数 explorerProvider。
 * @returns 返回 vscode.Disposable[] 列表。
 * 返回值示例：const list = registerExploreCommands('demo-value', 'demo-value', fsProvider, explorer); // [{ id: 'demo' }]
 */
export function registerExploreCommands(
  scheme: string,
  authority: string,
  fsProvider: WritableFileSystemProvider,
  explorerProvider: Refreshable
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand("vortex.request.create", (target?: vscode.TreeItem) =>
      createNodeCommand(scheme, authority, explorerProvider, target)
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


/**
 * 方法：createNodeCommand
 * 说明：处理新建请求/目录输入、冲突校验与打开文件流程。
 * @param scheme 参数 scheme。
 * @param authority 参数 authority。
 * @param explorerProvider 参数 explorerProvider。
 * @param target 参数 target。
 * @returns 异步完成后无返回值。
 * 返回值示例：await createNodeCommand('demo-value', 'demo-value', explorer, targetNode); // undefined
 */
async function createNodeCommand(
  scheme: string,
  authority: string,
  explorerProvider: Refreshable,
  target?: vscode.TreeItem
): Promise<void> {
  // 变量：baseUri，用于保存当前流程中的中间状态。
  const baseUri = getResourceUri(target);
  // 变量：basePath，用于保存当前流程中的中间状态。
  const basePath = baseUri ? getParentFolderPath(baseUri) : "/";
  // 变量：input，用于保存当前流程中的中间状态。
  const input = await vscode.window.showInputBox({
    prompt: "输入请求名或目录名，目录请以 / 结尾",
    placeHolder: "例如: users/list 或 archive/"
  });
  // 变量：next，用于保存当前流程中的中间状态。
  const next = buildCreationTarget(basePath, input);

  if (!next) {
    return;
  }

  if (getPathType(collections, next.path)) {
    showWarning(`目标已存在: ${next.path}`);
    return;
  }

  createItem(collections, next.path, next.isDir);
  explorerProvider.refresh();

  if (!next.isDir) {
    await openRequest(scheme, authority, next.path);
  }
}

/**
 * 方法：renameNodeCommand
 * 说明：处理节点重命名交互与路径迁移。
 * @param fsProvider 参数 fsProvider。
 * @param target 参数 target。
 * @returns 异步完成后无返回值。
 * 返回值示例：await renameNodeCommand(fsProvider, targetNode); // undefined
 */
async function renameNodeCommand(
  fsProvider: WritableFileSystemProvider,
  target?: vscode.TreeItem
): Promise<void> {
  // 变量：resourceUri，用于保存当前流程中的中间状态。
  const resourceUri = getResourceUri(target);
  if (!resourceUri) {
    return;
  }

  // 变量：oldUri，用于保存当前流程中的中间状态。
  const oldUri = toEntityUri(resourceUri);
  // 变量：currentPath，用于保存当前流程中的中间状态。
  const currentPath = ensureRequestPathWithoutExtension(oldUri.path);
  // 变量：newName，用于保存当前流程中的中间状态。
  const newName = await vscode.window.showInputBox({
    prompt: "输入新的名称",
    value: basenamePath(currentPath)
  });
  // 变量：trimmed，用于保存当前流程中的中间状态。
  const trimmed = newName?.trim();

  if (!trimmed) {
    return;
  }

  // 变量：nextPath，用于保存当前流程中的中间状态。
  const nextPath = joinPath(dirnamePath(currentPath), trimmed);
  if (!canRenameToPath(currentPath, nextPath)) {
    showWarning(`目标已存在: ${nextPath}`);
    return;
  }

  fsProvider.rename(oldUri, buildUri(oldUri.scheme, oldUri.authority, nextPath));
  if (isRequestUri(resourceUri)) {
    await openRequest(oldUri.scheme, oldUri.authority, nextPath);
  }
}

/**
 * 方法：deleteNodeCommand
 * 说明：处理删除确认弹窗并执行删除。
 * @param fsProvider 参数 fsProvider。
 * @param target 参数 target。
 * @returns 异步完成后无返回值。
 * 返回值示例：await deleteNodeCommand(fsProvider, targetNode); // undefined
 */
async function deleteNodeCommand(
  fsProvider: WritableFileSystemProvider,
  target?: vscode.TreeItem
): Promise<void> {
  // 变量：resourceUri，用于保存当前流程中的中间状态。
  const resourceUri = getResourceUri(target);
  if (!resourceUri) {
    return;
  }

  // 变量：targetUri，用于保存当前流程中的中间状态。
  const targetUri = toEntityUri(resourceUri);
  // 变量：confirmed，用于保存当前流程中的中间状态。
  const confirmed = await vscode.window.showWarningMessage(
    `确认删除 ${basenamePath(targetUri.path) || "/"} 吗？`,
    { modal: true },
    "Delete"
  );

  if (confirmed === "Delete") {
    fsProvider.delete(targetUri, { recursive: true });
  }
}

/**
 * 方法：sendRequestCommand
 * 说明：保存文档、准备运行时变量并发送请求。
 * @param target 参数 target。
 * @returns 异步完成后无返回值。
 * 返回值示例：await sendRequestCommand(targetNode); // undefined
 */
async function sendRequestCommand(target?: vscode.TreeItem): Promise<void> {
  // 变量：resourceUri，用于保存当前流程中的中间状态。
  const resourceUri = getResourceUri(target);
  if (!resourceUri) {
    return;
  }

  if (!await saveActiveRequestIfDirty(resourceUri)) {
    showWarning("Failed to save the current request before sending.");
    return;
  }

  // 变量：request，用于存储请求。
  const request = getRequiredRequest(resourceUri);
  if (!request) {
    return;
  }

  if (isRequestRunning(request.id)) {
    showWarning(`Request is already running: ${request.id}`);
    return;
  }

  try {
    // 变量：variables，用于保存当前流程中的中间状态。
    const variables = await prepareRuntimeVariables(resourceUri, request);
    // 变量：response，用于保存当前流程中的中间状态。
    const response = await clientHttp(request.id, request, variables);
    await runPostHook(resourceUri, request, variables, response);
  } catch (error) {
    showWarning(error instanceof Error ? error.message : String(error));
  }
}

/**
 * 方法：runPostHook
 * 说明：执行 post 脚本并将变量回写到运行时上下文。
 * @param resourceUri 参数 resourceUri。
 * @param request 参数 request。
 * @param variables 参数 variables。
 * @param response 参数 response。
 * @returns 异步完成后无返回值。
 * 返回值示例：await runPostHook(uri, request, { token: 'abc' }, { ok: true }); // undefined
 */
async function runPostHook(
  resourceUri: vscode.Uri,
  request: RequestSnapshot,
  variables: Record<string, unknown>,
  response: unknown
): Promise<void> {
  // 变量：postScript，用于保存当前流程中的中间状态。
  const postScript = request.scripts?.post?.trim();
  if (!postScript) {
    return;
  }

  await runHookStrict(postScript, {
    client: variables,
    variables,
    request,
    response
  });
  setRuntimeVhtVariables(resourceUri, variables);
}

/**
 * 方法：stopRequestCommand
 * 说明：优先停止当前请求，必要时回退到活动请求。
 * @param target 参数 target。
 * @returns 异步完成后无返回值。
 * 返回值示例：await stopRequestCommand(targetNode); // undefined
 */
async function stopRequestCommand(target?: vscode.TreeItem): Promise<void> {
  // 变量：resourceUri，用于保存当前流程中的中间状态。
  const resourceUri = getResourceUri(target);
  // 变量：fallbackRequestId，用于存储fallback请求id。
  const fallbackRequestId = getActiveRequestId();

  if (resourceUri) {
    // 变量：request，用于存储请求。
    const request = getRequiredRequest(resourceUri);
    if (request && isRequestRunning(request.id)) {
      await stop(request.id);
      return;
    }
  }

  if (fallbackRequestId) {
    await stop(fallbackRequestId);
  }
}
