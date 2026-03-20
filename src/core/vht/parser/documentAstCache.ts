import * as vscode from "vscode";
import { VhtParser } from "./index";
import { VhtAST } from "./types";

interface AstCacheEntry {
  version: number;
  ast: VhtAST;
}

export class DocumentAstCache implements vscode.Disposable {
  // 变量：parser，用于存储解析器。
  private readonly parser = new VhtParser();
  // 变量：entries，用于存储entries。
  private readonly entries = new Map<string, AstCacheEntry>();

  /**
   * 方法：get
   * 说明：执行 get 相关处理逻辑。
   * @param document 参数 document。
   * @returns 返回 VhtAST 类型结果。
   * 返回值示例：const result = get(document); // { ok: true }
   */
  get(document: vscode.TextDocument): VhtAST {
    // 变量：key，用于存储key。
    const key = document.uri.toString();
    // 变量：cached，用于存储cached。
    const cached = this.entries.get(key);
    if (cached && cached.version === document.version) {
      return cached.ast;
    }

    // 变量：ast，用于存储语法树。
    const ast = this.parser.parse(document.getText());
    this.entries.set(key, { version: document.version, ast });

    if (this.entries.size > 128) {
      this.entries.clear();
      this.entries.set(key, { version: document.version, ast });
    }

    return ast;
  }

  /**
   * 方法：delete
   * 说明：执行 delete 相关处理逻辑。
   * @param document 参数 document。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：delete(document); // undefined
   */
  delete(document: vscode.TextDocument | vscode.Uri): void {
    // 变量：key，用于存储key。
    const key = document instanceof vscode.Uri ? document.toString() : document.uri.toString();
    this.entries.delete(key);
  }

  /**
   * 方法：clear
   * 说明：执行 clear 相关处理逻辑。
   * @param 无 无参数。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：clear(); // undefined
   */
  clear(): void {
    this.entries.clear();
  }

  /**
   * 方法：dispose
   * 说明：执行 dispose 相关处理逻辑。
   * @param 无 无参数。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：dispose(); // undefined
   */
  dispose(): void {
    this.clear();
  }
}
