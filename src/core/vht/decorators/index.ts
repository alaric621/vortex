import * as vscode from "vscode";
import type { AST, VariableNode } from "../engine/parser/types";
import { isVhtEditor } from "../../../utils/editor";
import { buildAstFromVariables, buildVariableDecorations } from "./variable";

type VariableScope = Record<string, unknown>;

export class VariableDecorator implements vscode.Disposable {
  // 变量：hiddenExpressionDecoration，用于存储hidden表达式decoration。
  private readonly hiddenExpressionDecoration: vscode.TextEditorDecorationType;
  // 变量：inlineResolvedDecoration，用于存储inlineresolveddecoration。
  private readonly inlineResolvedDecoration: vscode.TextEditorDecorationType;
  // 变量：errorDecoration，用于存储错误decoration。
  private readonly errorDecoration: vscode.TextEditorDecorationType;

  constructor() {
    this.hiddenExpressionDecoration = vscode.window.createTextEditorDecorationType({
      color: "transparent"
    });
    this.inlineResolvedDecoration = vscode.window.createTextEditorDecorationType({});
    this.errorDecoration = vscode.window.createTextEditorDecorationType({
      border: "1px dotted",
      borderColor: new vscode.ThemeColor("editorError.foreground")
    });
  }

  /**
   * 方法：update
   * 说明：执行 update 相关处理逻辑。
   * @param ast 参数 ast。
   * @param variables 参数 variables。
   * @param editor 参数 editor。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：update(ast, variables, editor); // undefined
   */
  public update(ast: AST, variables: VariableScope, editor?: vscode.TextEditor): void {
    // 变量：target，用于存储target。
    const target = editor ?? vscode.window.activeTextEditor;
    if (!isVhtEditor(target)) {
      return;
    }

    // 变量：activePosition，用于存储active位置。
    const activePosition = target.selection.active;
    const { hiddenRanges, inlineOptions, errorRanges } = buildVariableDecorations(ast, variables, activePosition);

    target.setDecorations(this.hiddenExpressionDecoration, hiddenRanges);
    target.setDecorations(this.inlineResolvedDecoration, inlineOptions);
    target.setDecorations(this.errorDecoration, errorRanges);
  }

  /**
   * 方法：dispose
   * 说明：执行 dispose 相关处理逻辑。
   * @param 无 无参数。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：dispose(); // undefined
   */
  public dispose(): void {
    this.hiddenExpressionDecoration.dispose();
    this.inlineResolvedDecoration.dispose();
    this.errorDecoration.dispose();
  }
}

let sharedDecorator: VariableDecorator | undefined;

function getSharedDecorator(): VariableDecorator {
  if (!sharedDecorator) {
    sharedDecorator = new VariableDecorator();
  }
  return sharedDecorator;
}

/**
 * 方法：Decorators
 * 说明：使用变量节点与变量上下文直接更新装饰器。
 * @param variables 参数 variables。
 * @param scope 参数 scope。
 * @param editor 参数 editor。
 * @returns 无返回值，通过副作用完成处理。
 * 返回值示例：Decorators(nodes, scope, editor); // undefined
 */
export function Decorators(
  variables: VariableNode[],
  scope: VariableScope,
  editor?: vscode.TextEditor
): void {
  const ast = buildAstFromVariables(variables);
  getSharedDecorator().update(ast, scope, editor);
}
