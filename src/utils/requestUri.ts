import * as vscode from "vscode";
import {
  dirnamePath,
  ensureRequestPathWithoutExtension,
  normalizePath
} from "./path";

/**
 * 方法：isRequestUri
 * 说明：执行 isRequestUri 相关处理逻辑。
 * @param uri 参数 uri。
 * @returns 返回 uri is vscode.Uri 类型结果。
 * 返回值示例：const result = isRequestUri(uri); // { ok: true }
 */
export function isRequestUri(uri: vscode.Uri | undefined): uri is vscode.Uri {
  return Boolean(uri?.path.endsWith(".vht"));
}

/**
 * 方法：getFocusedRequestUri
 * 说明：执行 getFocusedRequestUri 相关处理逻辑。
 * @param scheme 参数 scheme。
 * @returns 命中时返回 vscode.Uri，未命中时返回 undefined。
 * 返回值示例：const result = getFocusedRequestUri('demo-value'); // { ok: true } 或 undefined
 */
export function getFocusedRequestUri(scheme: string = "vortex-fs"): vscode.Uri | undefined {
  // 变量：uri，用于存储资源标识。
  const uri = vscode.window.activeTextEditor?.document.uri;
  return uri?.scheme === scheme && isRequestUri(uri) ? uri : undefined;
}

/**
 * 方法：getResourceUri
 * 说明：执行 getResourceUri 相关处理逻辑。
 * @param target 参数 target。
 * @param scheme 参数 scheme。
 * @returns 命中时返回 vscode.Uri，未命中时返回 undefined。
 * 返回值示例：const result = getResourceUri(targetNode, 'demo-value'); // { ok: true } 或 undefined
 */
export function getResourceUri(target?: vscode.TreeItem, scheme: string = "vortex-fs"): vscode.Uri | undefined {
  return target?.resourceUri ?? getFocusedRequestUri(scheme);
}

/**
 * 方法：toRequestUri
 * 说明：执行 toRequestUri 相关处理逻辑。
 * @param uri 参数 uri。
 * @returns 返回 vscode.Uri 类型结果。
 * 返回值示例：const result = toRequestUri(uri); // { ok: true }
 */
export function toRequestUri(uri: vscode.Uri): vscode.Uri {
  return uri.path.endsWith(".vht") ? uri : uri.with({ path: `${uri.path}.vht` });
}

/**
 * 方法：toEntityUri
 * 说明：执行 toEntityUri 相关处理逻辑。
 * @param uri 参数 uri。
 * @returns 返回 vscode.Uri 类型结果。
 * 返回值示例：const result = toEntityUri(uri); // { ok: true }
 */
export function toEntityUri(uri: vscode.Uri): vscode.Uri {
  return uri.path.endsWith(".vht")
    ? uri.with({ path: ensureRequestPathWithoutExtension(uri.path) })
    : uri;
}

/**
 * 方法：buildUri
 * 说明：执行 buildUri 相关处理逻辑。
 * @param scheme 参数 scheme。
 * @param authority 参数 authority。
 * @param path 参数 path。
 * @returns 返回 vscode.Uri 类型结果。
 * 返回值示例：const result = buildUri('demo-value', 'demo-value', 'demo-value'); // { ok: true }
 */
export function buildUri(scheme: string, authority: string, path: string): vscode.Uri {
  return vscode.Uri.from({
    scheme,
    authority,
    path: normalizePath(path)
  });
}

/**
 * 方法：getParentFolderPath
 * 说明：执行 getParentFolderPath 相关处理逻辑。
 * @param uri 参数 uri。
 * @returns 返回 string 类型结果。
 * 返回值示例：const text = getParentFolderPath(uri); // 'demo-value'
 */
export function getParentFolderPath(uri: vscode.Uri): string {
  // 变量：entityPath，用于存储entity路径。
  const entityPath = ensureRequestPathWithoutExtension(uri.path);
  return isRequestUri(uri) ? dirnamePath(entityPath) : normalizePath(entityPath);
}
