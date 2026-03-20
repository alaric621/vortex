import * as vscode from "vscode";
import { getHeaderCompletions, isInHeaderSection } from "./header";
import { findNodeAtPosition } from "../engine/parser/types";
import { getRequestLineCompletions, isInRequestLine } from "./requestLine";
import { getVariableCompletions } from "./variable";
import { DocumentAstCache } from "../documentAstCache";

export class CompletionProvider implements vscode.CompletionItemProvider {
  constructor(private readonly astCache: DocumentAstCache = new DocumentAstCache()) {}

  /**
   * 方法：provideCompletionItems
   * 说明：执行 provideCompletionItems 相关处理逻辑。
   * @param document 参数 document。
   * @param position 参数 position。
   * @returns 返回 vscode.CompletionItem[] 列表。
   * 返回值示例：const list = provideCompletionItems(document, position); // [{ id: 'demo' }]
   */
  public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
    // 变量：ast，用于存储语法树。
    const ast = this.astCache.get(document);
    // 变量：variableItems，用于存储变量items。
    const variableItems = getVariableCompletions(document, position, ast);
    if (variableItems.length > 0) {
      return variableItems;
    }

    // 变量：node，用于存储节点。
    const node = findNodeAtPosition(ast.nodes, position.line, position.character);
    if (isInHeaderSection(document, ast, position, node)) {
      return getHeaderCompletions(document, position, ast);
    }

    if (isInRequestLine(document, ast, position, node)) {
      return getRequestLineCompletions(document, position, ast);
    }

    return node ? [] : [createInitialRequestCompletion()];
  }
}

/**
 * 方法：createInitialRequestCompletion
 * 说明：执行 createInitialRequestCompletion 相关处理逻辑。
 * @param 无 无参数。
 * @returns 返回 vscode.CompletionItem 类型结果。
 * 返回值示例：const result = createInitialRequestCompletion(); // { ok: true }
 */
function createInitialRequestCompletion(): vscode.CompletionItem {
  // 变量：item，用于存储item。
  const item = new vscode.CompletionItem("GET", vscode.CompletionItemKind.Keyword);
  item.insertText = new vscode.SnippetString("GET ${1:http://localhost:3000}");
  return item;
}
