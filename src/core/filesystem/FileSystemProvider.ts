import * as vscode from "vscode";
import { VhtConverter } from "../vht/converter";
import { VhtParser } from "../vht/parser";
import {
  getDirContent,
  getStat,
  deleteNode,
  renameNode,
  createItem,
  getFileContent,
  getPathType,
  updateFile
} from "./store";
import { ensureRequestPathWithoutExtension } from "../../utils/path";
import { globContext } from "../../context";

export class FileSystemProvider implements vscode.FileSystemProvider {
  // 变量：didChangeFileEmitter，用于存储didchange文件emitter。
  private readonly didChangeFileEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  // 变量：parser，用于存储解析器。
  private readonly parser = new VhtParser();
  // 变量：converter，用于存储converter。
  private readonly converter = new VhtConverter();

  // 变量：onDidChangeFile，用于存储ondidchange文件。
  readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this.didChangeFileEmitter.event;

  /**
   * 方法：toSerializableRequest
   * 说明：执行 toSerializableRequest 相关处理逻辑。
   * @param request 参数 request。
   * @returns 返回 { type: string; url: string; headers: Record<string, string>; body: string; scripts: { pre: string; post: string }; } 类型结果。
   * 返回值示例：const result = toSerializableRequest({ ... }); // { ok: true }
   */
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

  /**
   * 方法：toRequestPath
   * 说明：执行 toRequestPath 相关处理逻辑。
   * @param uri 参数 uri。
   * @returns 返回 string 类型结果。
   * 返回值示例：const text = toRequestPath(uri); // 'demo-value'
   */
  private toRequestPath(uri: vscode.Uri): string {
    return ensureRequestPathWithoutExtension(uri.path);
  }

  /**
   * 方法：getRequestOrThrow
   * 说明：执行 getRequestOrThrow 相关处理逻辑。
   * @param uri 参数 uri。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：getRequestOrThrow(uri); // undefined
   */
  private getRequestOrThrow(uri: vscode.Uri) {
    // 变量：request，用于存储请求。
    const request = getFileContent(globContext.collections, this.toRequestPath(uri));
    if (!request) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }

    return request;
  }

  /**
   * 方法：fireChange
   * 说明：执行 fireChange 相关处理逻辑。
   * @param type 参数 type。
   * @param uri 参数 uri。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：fireChange({ ... }, uri); // undefined
   */
  private fireChange(type: vscode.FileChangeType, uri: vscode.Uri): void {
    this.didChangeFileEmitter.fire([{ type, uri }]);
    this.refresh();
  }

  /**
   * 方法：resetCollections
   * 说明：执行 resetCollections 相关处理逻辑。
   * @param next 参数 next。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：resetCollections({ ... }); // undefined
   */
  private resetCollections(next: typeof globContext.collections): void {
    globContext.collections.length = 0;
    globContext.collections.push(...next);
  }

  /**
   * 方法：encodeRequest
   * 说明：执行 encodeRequest 相关处理逻辑。
   * @param request 参数 request。
   * @returns 返回 Buffer 类型结果。
   * 返回值示例：const result = encodeRequest(request); // { ok: true }
   */
  private encodeRequest(request: ReturnType<typeof getFileContent>): Buffer {
    // 变量：content，用于存储内容。
    const content = request ? this.converter.jsonToVht(this.toSerializableRequest(request)) : "";
    return Buffer.from(content, "utf8");
  }

  /**
   * 方法：getNodeOrThrow
   * 说明：执行 getNodeOrThrow 相关处理逻辑。
   * @param uri 参数 uri。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：getNodeOrThrow(uri); // undefined
   */
  private getNodeOrThrow(uri: vscode.Uri) {
    // 变量：node，用于存储节点。
    const node = getStat(globContext.collections, this.toRequestPath(uri));
    if (!node) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }

    return node;
  }

  /**
   * 方法：assertCreatablePath
   * 说明：执行 assertCreatablePath 相关处理逻辑。
   * @param uri 参数 uri。
   * @param path 参数 path。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：assertCreatablePath(uri, 'demo-value'); // undefined
   */
  private assertCreatablePath(uri: vscode.Uri, path: string): void {
    if (getPathType(globContext.collections, path)) {
      throw vscode.FileSystemError.FileExists(uri);
    }
  }

  /**
   * 方法：assertWritablePath
   * 说明：执行 assertWritablePath 相关处理逻辑。
   * @param uri 参数 uri。
   * @param path 参数 path。
   * @param options 参数 options。
   * @returns 返回 "created" | "updated" 类型结果。
   * 返回值示例：const result = assertWritablePath(uri, 'demo-value', { ... }); // { ok: true }
   */
  private assertWritablePath(
    uri: vscode.Uri,
    path: string,
    options: { create: boolean; overwrite: boolean }
  ): "created" | "updated" {
    // 变量：pathType，用于存储路径类型。
    const pathType = getPathType(globContext.collections, path);

    if (pathType === "dir") {
      throw vscode.FileSystemError.FileIsADirectory(uri);
    }
    if (pathType === "file" && !options.overwrite) {
      throw vscode.FileSystemError.FileExists(uri);
    }
    if (!pathType && !options.create) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }

    return pathType ? "updated" : "created";
  }

  /**
   * 方法：parseWritableRequest
   * 说明：执行 parseWritableRequest 相关处理逻辑。
   * @param content 参数 content。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：parseWritableRequest({ ... }); // undefined
   */
  private parseWritableRequest(content: Uint8Array) {
    // 变量：text，用于存储text。
    const text = Buffer.from(content).toString("utf8");
    // 变量：ast，用于存储语法树。
    const ast = this.validateWritableVht(text);
    return this.converter.astToJson(ast);
  }

  /**
   * 方法：saveRequest
   * 说明：执行 saveRequest 相关处理逻辑。
   * @param path 参数 path。
   * @param request 参数 request。
   * @param mode 参数 mode。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：saveRequest('demo-value', request, 'created'); // undefined
   */
  private saveRequest(path: string, request: ReturnType<VhtConverter["astToJson"]>, mode: "created" | "updated"): void {
    if (mode === "created") {
    createItem(globContext.collections, path, false);
    }

    // 变量：updated，用于存储updated。
    const updated = updateFile(globContext.collections, path, {
      type: request.type,
      url: request.url,
      headers: request.headers,
      body: request.body,
      scripts: request.scripts
    });

    if (updated) {
      return;
    }

    if (mode === "created") {
      this.resetCollections(deleteNode(globContext.collections, path));
    }

    throw vscode.FileSystemError.Unavailable(`Failed to update request: ${path}`);
  }

  /**
   * 方法：refresh
   * 说明：执行 refresh 相关处理逻辑。
   * @param 无 无参数。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：refresh(); // undefined
   */
  refresh(): void {
    this.didChangeFileEmitter.fire([{ type: vscode.FileChangeType.Changed, uri: vscode.Uri.parse("vortex-fs:/") }]);
  }

  /**
   * 方法：watch
   * 说明：执行 watch 相关处理逻辑。
   * @param _uri 参数 _uri。
   * @returns 返回 vscode.Disposable 类型结果。
   * 返回值示例：const result = watch(uri); // { ok: true }
   */
  watch(_uri: vscode.Uri): vscode.Disposable {
    return new vscode.Disposable(() => undefined);
  }

  /**
   * 方法：stat
   * 说明：执行 stat 相关处理逻辑。
   * @param uri 参数 uri。
   * @returns 返回 vscode.FileStat 类型结果。
   * 返回值示例：const result = stat(uri); // { ok: true }
   */
  stat(uri: vscode.Uri): vscode.FileStat {
    // 变量：node，用于存储节点。
    const node = this.getNodeOrThrow(uri);

    if (node.nodeType === vscode.FileType.Directory) {
      return {
        type: vscode.FileType.Directory,
        ctime: Number(node.ctime ?? Date.now()),
        mtime: Number(node.mtime ?? Date.now()),
        size: 0
      };
    }

    // 变量：encodedContent，用于存储encoded内容。
    const encodedContent = this.encodeRequest(this.getRequestOrThrow(uri));

    return {
      type: vscode.FileType.File,
      ctime: Number(node.ctime ?? Date.now()),
      mtime: Number(node.mtime ?? Date.now()),
      size: encodedContent.length
    };
  }

  /**
   * 方法：readDirectory
   * 说明：执行 readDirectory 相关处理逻辑。
   * @param uri 参数 uri。
   * @returns 返回 [string, vscode.FileType][] 列表。
   * 返回值示例：const list = readDirectory(uri); // [{ id: 'demo' }]
   */
  readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
    // 变量：contents，用于存储contents。
    const contents = getDirContent(globContext.collections, uri.path);
    return contents.map((node) => [
      node.name,
      node.nodeType,
    ]);
  }

  /**
   * 方法：createDirectory
   * 说明：执行 createDirectory 相关处理逻辑。
   * @param uri 参数 uri。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：createDirectory(uri); // undefined
   */
  createDirectory(uri: vscode.Uri): void {
    // 变量：fullPath，用于存储full路径。
    const fullPath = this.toRequestPath(uri);
    this.assertCreatablePath(uri, fullPath);
    createItem(globContext.collections, fullPath, true);
    this.fireChange(vscode.FileChangeType.Created, uri);
  }

  /**
   * 方法：readFile
   * 说明：执行 readFile 相关处理逻辑。
   * @param uri 参数 uri。
   * @returns 返回 Uint8Array 类型结果。
   * 返回值示例：const result = readFile(uri); // { ok: true }
   */
  readFile(uri: vscode.Uri): Uint8Array {
    return this.encodeRequest(this.getRequestOrThrow(uri));
  }

  /**
   * 方法：validateWritableVht
   * 说明：执行 validateWritableVht 相关处理逻辑。
   * @param text 参数 text。
   * @returns 返回 ReturnType<VhtParser["parse"]> 类型结果。
   * 返回值示例：const result = validateWritableVht('demo-value'); // { ok: true }
   */
  private validateWritableVht(text: string): ReturnType<VhtParser["parse"]> {
    // 变量：ast，用于存储语法树。
    const ast = this.parser.parse(text);
    if (ast.errors.length > 0) {
      // 变量：message，用于存储message。
      const message = ast.errors[0]?.message ?? "Invalid VHT syntax.";
      throw vscode.FileSystemError.Unavailable(`Failed to save request: ${message}`);
    }

    if (!ast.sections.request) {
      throw vscode.FileSystemError.Unavailable("Failed to save request: missing request line.");
    }

    return ast;
  }

  /**
   * 方法：writeFile
   * 说明：执行 writeFile 相关处理逻辑。
   * @param uri 参数 uri。
   * @param content 参数 content。
   * @param options 参数 options。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：writeFile(uri, { ... }, { ... }); // undefined
   */
  writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean }): void {
    // 变量：fullPath，用于存储full路径。
    const fullPath = this.toRequestPath(uri);
    // 变量：mode，用于存储mode。
    const mode = this.assertWritablePath(uri, fullPath, options);
    // 变量：parsed，用于存储parsed。
    const parsed = this.parseWritableRequest(content);

    this.saveRequest(fullPath, parsed, mode);
    this.fireChange(
      mode === "created" ? vscode.FileChangeType.Created : vscode.FileChangeType.Changed,
      uri
    );
  }

  /**
   * 方法：delete
   * 说明：执行 delete 相关处理逻辑。
   * @param uri 参数 uri。
   * @param _options 参数 _options。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：delete(uri, { ... }); // undefined
   */
  delete(uri: vscode.Uri, _options: { recursive: boolean }): void {
    // 变量：fullPath，用于存储full路径。
    const fullPath = this.toRequestPath(uri);
    if (!getPathType(globContext.collections, fullPath)) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    this.resetCollections(deleteNode(globContext.collections, fullPath));
    this.fireChange(vscode.FileChangeType.Deleted, uri);
  }

  /**
   * 方法：rename
   * 说明：执行 rename 相关处理逻辑。
   * @param oldUri 参数 oldUri。
   * @param newUri 参数 newUri。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：rename(uri, uri); // undefined
   */
  rename(oldUri: vscode.Uri, newUri: vscode.Uri): void {
    // 变量：oldPath，用于存储old路径。
    const oldPath = this.toRequestPath(oldUri);
    // 变量：newPath，用于存储new路径。
    const newPath = this.toRequestPath(newUri);
    // 变量：oldType，用于存储old类型。
    const oldType = getPathType(globContext.collections, oldPath);
    if (!oldType) {
      throw vscode.FileSystemError.FileNotFound(oldUri);
    }

    // 变量：newType，用于存储new类型。
    const newType = getPathType(globContext.collections, newPath);
    if (newType && oldPath !== newPath) {
      throw vscode.FileSystemError.FileExists(newUri);
    }

    renameNode(globContext.collections, oldPath, newPath);
    this.didChangeFileEmitter.fire([
      { type: vscode.FileChangeType.Deleted, uri: oldUri },
      { type: vscode.FileChangeType.Created, uri: newUri }
    ]);
    this.refresh();
  }
}
