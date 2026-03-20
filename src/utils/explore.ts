import * as vscode from "vscode";
import { collections, getFileContent, getPathType } from "../core/filesystem/store";
import { ensureRequestPathWithoutExtension, joinPath, normalizePath } from "./path";
import { buildUri, toRequestUri } from "./requestUri";

export type RequestSnapshot = NonNullable<ReturnType<typeof getFileContent>>;

/**
 * 方法：getRequestByUri
 * 说明：根据资源 URI 提取对应请求的副本，路径最终会去掉 `.vht` 后缀。
 * @param uri 参数 uri。
 * @returns 命中时返回 RequestSnapshot，未命中返回 undefined。
 * 返回值示例：const result = getRequestByUri(vscode.Uri.parse("vortex://demo/req_get_health.vht")); // { id: "req_get_health", name: "GET-健康检查", url: "https://postman-echo.com/get?source=vortex", body: "" }
 */
export function getRequestByUri(uri: vscode.Uri): RequestSnapshot | undefined {
  const requestPath = ensureRequestPathWithoutExtension(uri.path);
  return getFileContent(collections, requestPath) ?? undefined;
}

/**
 * 方法：getRequiredRequest
 * 说明：获取必需的请求，如果不存在则弹出警告提示并返回 undefined。
 * @param uri 参数 uri。
 * @returns 命中时返回 RequestSnapshot，未命中返回 undefined。
 * 返回值示例：const result = getRequiredRequest(vscode.Uri.parse("vortex://demo/req_get_health.vht")); // { id: "req_get_health", url: "https://postman-echo.com/get?source=vortex" }
 */
export function getRequiredRequest(uri: vscode.Uri): RequestSnapshot | undefined {
  const request = getRequestByUri(uri);
  if (!request) {
    showWarning(`未找到请求: ${ensureRequestPathWithoutExtension(uri.path)}`);
  }
  return request;
}

/**
 * 方法：showWarning
 * 说明：统一的告警提示封装，方便复用与后续替换。
 * @param message 参数 message。
 * @returns 无返回值，通过副作用完成提示。
 * 返回值示例：showWarning("目标不存在"); // undefined
 */
export function showWarning(message: string): void {
  vscode.window.showWarningMessage(message);
}

/**
 * 方法：saveActiveRequestIfDirty
 * 说明：若目标请求被打开且存在未保存的修改，则在发送前先保存。
 * @param resourceUri 参数 resourceUri。
 * @returns 异步返回布尔值；true 表示保存成功或无修改，false 表示保存失败。
 * 返回值示例：const ok = await saveActiveRequestIfDirty(vscode.Uri.parse("vortex://demo/req_get_health.vht")); // true
 */
export async function saveActiveRequestIfDirty(resourceUri: vscode.Uri): Promise<boolean> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.uri.toString() !== resourceUri.toString() || !editor.document.isDirty) {
    return true;
  }

  return editor.document.save();
}

/**
 * 方法：openRequest
 * 说明：根据 scheme/authority/path 构建请求 URI 并通过 VS Code 打开。
 * @param scheme 参数 scheme。
 * @param authority 参数 authority。
 * @param path 参数 path。
 * @returns 异步完成后无返回值。
 * 返回值示例：await openRequest("vortex-fs", "demo", "/req_get_health"); // undefined
 */
export async function openRequest(scheme: string, authority: string, path: string): Promise<void> {
  await vscode.commands.executeCommand("vscode.open", toRequestUri(buildUri(scheme, authority, path)));
}

/**
 * 方法：canRenameToPath
 * 说明：当前路径可重命名到目标路径，当且仅当目标不存在或与当前路径等价。
 * @param currentPath 参数 currentPath。
 * @param nextPath 参数 nextPath。
 * @returns 返回布尔值；true 表示允许，false 表示冲突。
 * 返回值示例：const ok = canRenameToPath("/users/list", "/users/detail"); // true
 */
export function canRenameToPath(currentPath: string, nextPath: string): boolean {
  const existingType = getPathType(collections, nextPath);
  return !existingType || normalizePath(nextPath) === normalizePath(currentPath);
}

/**
 * 方法：buildCreationTarget
 * 说明：将用户输入的名称解析为标准路径与是否目录的元信息。
 * @param basePath 参数 basePath。
 * @param input 参数 input。
 * @returns 命中时返回 { path: string; isDir: boolean }，未命中返回 undefined。
 * 返回值示例：const target = buildCreationTarget("/", "users/"); // { path: "/users", isDir: true }
 */
export function buildCreationTarget(
  basePath: string,
  input: string | undefined
): { path: string; isDir: boolean } | undefined {
  const trimmed = input?.trim();
  if (!trimmed) {
    return undefined;
  }

  const isDir = trimmed.endsWith("/");
  const name = isDir ? trimmed.slice(0, -1) : trimmed;
  return {
    path: joinPath(basePath, name),
    isDir
  };
}
