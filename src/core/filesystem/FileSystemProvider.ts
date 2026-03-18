import * as vscode from "vscode";
import { getDirContent, getStat, collections, updateFile, deleteNode, renameNode } from "./context";
import { parseVhtToJson, parserJsonToVht } from "../paser";

function normalizeRequestPath(path: string): string {
  return path.endsWith(".vht") ? path.slice(0, -4) : path;
}

export class FileSystemProvider implements vscode.FileSystemProvider {
  
  private readonly didChangeFileEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();

  readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this.didChangeFileEmitter.event;

  refresh(): void {
    this.didChangeFileEmitter.fire([{ type: vscode.FileChangeType.Changed, uri: vscode.Uri.parse("vortex-fs:/") }]);
  }

  watch(_uri: vscode.Uri): vscode.Disposable {
    return new vscode.Disposable(() => undefined);
  }
  stat(uri: vscode.Uri): vscode.FileStat {
    const fullPath = uri.path.replace('.vht', '');
    const node = getStat(collections, fullPath);

    if (!node) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }

    // 必须拿到实际内容的长度
    const content = (node as any).content || "";
    const encodedContent = Buffer.from(content, "utf8");

    return {
      type: vscode.FileType.File, // 确保文件类型正确
      ctime: Date.now(),
      mtime: Date.now(),
      size: encodedContent.length // 这里不能为 0，除非文件真的为空
    };
  }
  readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
    const contents = getDirContent(collections, uri.path);
    return contents.map((node) => [
      node.name,
      node.nodeType,
    ]);
  }

  createDirectory(_uri: vscode.Uri): void {
    throw vscode.FileSystemError.NoPermissions("Directory create is not supported");
  }

  readFile(uri: vscode.Uri): Uint8Array {
    const fullPath = normalizeRequestPath(uri.path);
    const node = getStat(collections, fullPath);
    if (!node || node.nodeType !== 1) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }

    const content = parserJsonToVht(node);
    return Buffer.from(content, "utf8");
  }
  writeFile(uri: vscode.Uri, content: Uint8Array): void {
    const fullPath = normalizeRequestPath(uri.path);
    let contentJson;
    try {
      contentJson = parseVhtToJson(content.toString());
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown parse error";
      throw vscode.FileSystemError.Unavailable(`Invalid Request Format: ${message}`);
    }

    console.log(contentJson);
    if(!updateFile(collections, fullPath, contentJson)) {
      throw vscode.FileSystemError.Unavailable("Invalid Request Format");
    }
  }
  delete(uri: vscode.Uri, options: { recursive: boolean }): void {
    const fullPath = uri.path.replace('.vht', '');
    // 注意：如果是 export const，你需要一种方式更新引用，或者直接操作原数组
    const newData = deleteNode(collections, fullPath);
    collections.length = 0; // 清空
    collections.push(...newData); // 重新填充
    this.refresh();
  }
  rename(oldUri: vscode.Uri, newUri: vscode.Uri): void {
    const oldPath = oldUri.path.replace('.vht', '');
    const newPath = newUri.path.replace('.vht', '');
    renameNode(collections, oldPath, newPath);
    this.refresh();
  }
}
