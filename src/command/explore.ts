import * as vscode from "vscode";
import { FileTreeNode } from "../views/explore/fileTreeNode";
import { FolderTreeNode } from "../views/explore/folderTreeNode";
import { createItem, getPathType, collections, renameNode, deleteNode } from "../core/filesystem/context";
import { send, stop } from "../core/client";
import {
  basenamePath,
  dirnamePath,
  ensureRequestPathWithoutExtension,
  joinPath,
  normalizePath,
  stripVhtSuffix
} from "../core/filesystem/path-utils";

type ExplorerNode = FileTreeNode | FolderTreeNode;

const SCHEME = "vortex-fs";
const AUTHORITY = "request";
let latestRequestId: string | null = null;

/**
 * 统一错误提示
 */
const notifyError = (msg: string) => void vscode.window.showErrorMessage(`Vortex: ${msg}`);

/**
 * 获取节点纯净路径 (无后缀)
 */
function getNodePath(node: ExplorerNode): string {
  return stripVhtSuffix(node.resourceUri.path);
}

/**
 * 将路径转换为自定义协议 URI
 */
function toRequestUri(path: string, isFile: boolean): vscode.Uri {
  const normalized = normalizePath(path);
  return vscode.Uri.from({
    scheme: SCHEME,
    authority: AUTHORITY,
    path: isFile ? `${normalized}.vht` : normalized
  });
}

/**
 * 核心逻辑：获取当前操作的目标 URI
 */
export async function resolveActiveUri(node?: ExplorerNode): Promise<vscode.Uri | null> {
  // 1. 优先使用传入的节点
  if (node instanceof FileTreeNode) return node.resourceUri;
  
  // 2. 其次尝试当前活跃的编辑器
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor?.document.uri.scheme === SCHEME) {
    return activeEditor.document.uri;
  }
  return null;
}

export async function exploreCreate(node?: ExplorerNode): Promise<void> {
  // 确定基准目录
  let basePath = "/";
  if (node instanceof FolderTreeNode) {
    basePath = normalizePath(node.resourceUri.path);
  } else if (node instanceof FileTreeNode) {
    basePath = dirnamePath(getNodePath(node));
  }

  const input = await vscode.window.showInputBox({
    prompt: "创建：输入 'dir/' 或 'name' (请求)",
    placeHolder: "example/api",
    ignoreFocusOut: true
  });

  const raw = input?.trim();
  if (!raw) return;

  const isDir = raw.endsWith("/");
  const entryName = isDir ? raw.slice(0, -1) : raw;
  if (!entryName) return;

  const targetPath = isDir 
    ? joinPath(basePath, entryName) 
    : ensureRequestPathWithoutExtension(joinPath(basePath, entryName));

  if (getPathType(collections, targetPath)) {
    return notifyError(`路径已存在: ${targetPath}`);
  }

  try {
    createItem(collections, targetPath, isDir);
    await vscode.commands.executeCommand("vortex.request.refresh");
    
    if (!isDir) {
      const uri = toRequestUri(targetPath, true);
      await vscode.commands.executeCommand("vscode.open", uri);
    }
  } catch (e) {
    notifyError(`创建失败: ${e instanceof Error ? e.message : "未知错误"}`);
  }
}

export async function exploreRename(node?: ExplorerNode): Promise<void> {
  if (!node) return notifyError("请选择要重命名的节点");

  const oldPath = getNodePath(node);
  if (oldPath === "/") return notifyError("根目录不可重命名");

  const oldName = basenamePath(oldPath);
  const input = await vscode.window.showInputBox({
    prompt: "重命名或移动",
    value: oldName,
    valueSelection: [0, oldName.length] 
  });

  const trimmed = input?.trim();
  if (!trimmed || trimmed === oldName) return;

  const parent = dirnamePath(oldPath);
  const isAbs = trimmed.startsWith("/");
  let newPath = isAbs ? normalizePath(trimmed) : joinPath(parent, trimmed);
  
  const type = getPathType(collections, oldPath);
  if (type === "file") {
    newPath = ensureRequestPathWithoutExtension(newPath);
  }

  if (getPathType(collections, newPath)) {
    return notifyError("目标路径已存在");
  }

  renameNode(collections, oldPath, newPath);
  await vscode.commands.executeCommand("vortex.request.refresh");
}

export async function exploreDelete(node?: ExplorerNode): Promise<void> {
  if (!node) return;
  const targetPath = getNodePath(node);
  if (targetPath === "/") return notifyError("禁止删除根目录");
  // 优化点：使用不可变思路更新数组，避免直接操作全局引用导致的脏数据
  const updated = deleteNode(collections, targetPath);
  collections.splice(0, collections.length, ...updated); 
  
  await vscode.commands.executeCommand("vortex.request.refresh");
}

export async function exploreSend(node?: ExplorerNode): Promise<void> {
    send({id:"fsdfs"});
}

export async function exploreStop(): Promise<void> {
  if (latestRequestId) {
    await stop(latestRequestId);
    latestRequestId = null;
  }
}