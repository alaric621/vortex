import * as vscode from "vscode";
import { VhtConverter } from "../vht/converter";
import { VhtParser } from "../vht/parser";
import {
  getDirContent,
  getStat,
  collections,
  deleteNode,
  renameNode,
  createItem,
  getFileContent,
  getPathType,
  updateFile
} from "./context";
import { ensureRequestPathWithoutExtension } from "./path-utils";

export class FileSystemProvider implements vscode.FileSystemProvider {
  private readonly didChangeFileEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  private readonly parser = new VhtParser();
  private readonly converter = new VhtConverter();

  readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this.didChangeFileEmitter.event;

  private toSerializableRequest(request: {
    type?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: string;
    scripts?: { pre?: string; post?: string };
  }): {
    type: string;
    url: string;
    headers: Record<string, string>;
    body: string;
    scripts: { pre: string; post: string };
  } {
    return {
      type: request.type ?? "GET",
      url: request.url ?? "",
      headers: request.headers ?? {},
      body: request.body ?? "",
      scripts: {
        pre: request.scripts?.pre ?? "",
        post: request.scripts?.post ?? ""
      }
    };
  }

  refresh(): void {
    this.didChangeFileEmitter.fire([{ type: vscode.FileChangeType.Changed, uri: vscode.Uri.parse("vortex-fs:/") }]);
  }

  watch(_uri: vscode.Uri): vscode.Disposable {
    return new vscode.Disposable(() => undefined);
  }

  stat(uri: vscode.Uri): vscode.FileStat {
    const fullPath = ensureRequestPathWithoutExtension(uri.path);
    const node = getStat(collections, fullPath);

    if (!node) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }

    if (node.nodeType === vscode.FileType.Directory) {
      return {
        type: vscode.FileType.Directory,
        ctime: Number(node.ctime ?? Date.now()),
        mtime: Number(node.mtime ?? Date.now()),
        size: 0
      };
    }

    const request = getFileContent(collections, fullPath);
    const content = request ? this.converter.jsonToVht(this.toSerializableRequest(request)) : "";
    const encodedContent = Buffer.from(content, "utf8");

    return {
      type: vscode.FileType.File,
      ctime: Number(node.ctime ?? Date.now()),
      mtime: Number(node.mtime ?? Date.now()),
      size: encodedContent.length
    };
  }

  readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
    const contents = getDirContent(collections, uri.path);
    return contents.map((node) => [
      node.name,
      node.nodeType,
    ]);
  }

  createDirectory(uri: vscode.Uri): void {
    const fullPath = ensureRequestPathWithoutExtension(uri.path);
    if (getPathType(collections, fullPath)) {
      throw vscode.FileSystemError.FileExists(uri);
    }

    createItem(collections, fullPath, true);
    this.didChangeFileEmitter.fire([
      { type: vscode.FileChangeType.Created, uri }
    ]);
    this.refresh();
  }

  readFile(uri: vscode.Uri): Uint8Array {
    const fullPath = ensureRequestPathWithoutExtension(uri.path);
    const request = getFileContent(collections, fullPath);
    if (!request) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }

    return Buffer.from(this.converter.jsonToVht(this.toSerializableRequest(request)), "utf8");
  }

  writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean }): void {
    const fullPath = ensureRequestPathWithoutExtension(uri.path);
    const pathType = getPathType(collections, fullPath);

    if (pathType === "dir") {
      throw vscode.FileSystemError.FileIsADirectory(uri);
    }
    if (pathType === "file" && !options.overwrite) {
      throw vscode.FileSystemError.FileExists(uri);
    }
    if (!pathType && !options.create) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }

    if (!pathType) {
      createItem(collections, fullPath, false);
    }

    const text = Buffer.from(content).toString("utf8");
    const ast = this.parser.parse(text);
    const parsed = this.converter.astToJson(ast);
    const updated = updateFile(collections, fullPath, {
      type: parsed.type,
      url: parsed.url,
      headers: parsed.headers,
      body: parsed.body,
      scripts: parsed.scripts
    });

    if (!updated) {
      throw vscode.FileSystemError.Unavailable(`Failed to update request: ${uri.toString()}`);
    }

    this.didChangeFileEmitter.fire([
      { type: pathType ? vscode.FileChangeType.Changed : vscode.FileChangeType.Created, uri }
    ]);
    this.refresh();
  }

  delete(uri: vscode.Uri, _options: { recursive: boolean }): void {
    const fullPath = ensureRequestPathWithoutExtension(uri.path);
    const newData = deleteNode(collections, fullPath);
    collections.length = 0;
    collections.push(...newData);
    this.didChangeFileEmitter.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
    this.refresh();
  }

  rename(oldUri: vscode.Uri, newUri: vscode.Uri): void {
    const oldPath = ensureRequestPathWithoutExtension(oldUri.path);
    const newPath = ensureRequestPathWithoutExtension(newUri.path);
    renameNode(collections, oldPath, newPath);
    this.didChangeFileEmitter.fire([
      { type: vscode.FileChangeType.Deleted, uri: oldUri },
      { type: vscode.FileChangeType.Created, uri: newUri }
    ]);
    this.refresh();
  }
}
