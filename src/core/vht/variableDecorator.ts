import * as vscode from "vscode";
import { getVhtVariables } from "../../context";
import { resolveRenderExpression } from "../render";
import { DocumentAstCache } from "./parser/documentAstCache";
import { isVhtEditor } from "../../utils/editor";
import { rangeContainsPosition, toVsCodeRange } from "../../utils/range";

type VariableScope = Record<string, unknown>;
type EvalResult = unknown | typeof UNRESOLVED;

// 变量：UNRESOLVED，用于存储unresolved。
const UNRESOLVED = Symbol("UNRESOLVED");

export class VariableDecorator implements vscode.Disposable {
  // 变量：hiddenExpressionDecoration，用于存储hidden表达式decoration。
  private readonly hiddenExpressionDecoration: vscode.TextEditorDecorationType;
  // 变量：inlineResolvedDecoration，用于存储inlineresolveddecoration。
  private readonly inlineResolvedDecoration: vscode.TextEditorDecorationType;
  // 变量：errorDecoration，用于存储错误decoration。
  private readonly errorDecoration: vscode.TextEditorDecorationType;

  constructor(private readonly astCache: DocumentAstCache = new DocumentAstCache()) {
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
   * @param editor 参数 editor。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：update(editor); // undefined
   */
  public update(editor?: vscode.TextEditor): void {
    // 变量：target，用于存储target。
    const target = editor ?? vscode.window.activeTextEditor;
    if (!isVhtEditor(target)) {
      return;
    }

    // 变量：activePosition，用于存储active位置。
    const activePosition = target.selection.active;
    // 变量：variables，用于存储变量。
    const variables = getVhtVariables(target.document.uri);
    // 变量：expressionCache，用于存储表达式缓存。
    const expressionCache = new Map<string, EvalResult>();
    // 变量：hiddenRanges，用于存储hiddenranges。
    const hiddenRanges: vscode.Range[] = [];
    // 变量：inlineOptions，用于存储inlineoptions。
    const inlineOptions: vscode.DecorationOptions[] = [];
    // 变量：errorRanges，用于存储错误ranges。
    const errorRanges: vscode.Range[] = [];

    for (const variable of this.astCache.get(target.document).variables) {
      // 变量：range，用于存储范围。
      const range = toVsCodeRange(variable.range);
      if (shouldSkipRange(range, activePosition)) {
        continue;
      }

      // 变量：resolved，用于存储resolved。
      const resolved = resolveExpressionCached(variable.expression, variables, expressionCache);
      if (resolved === UNRESOLVED) {
        errorRanges.push(range);
        continue;
      }

      hiddenRanges.push(range);
      inlineOptions.push(createInlineResolvedOption(range, variable.expression, String(resolved)));
    }

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

/**
 * 方法：shouldSkipRange
 * 说明：执行 shouldSkipRange 相关处理逻辑。
 * @param range 参数 range。
 * @param position 参数 position。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = shouldSkipRange(range, position); // true
 */
function shouldSkipRange(range: vscode.Range, position: vscode.Position): boolean {
  return rangeContainsPosition(range, position) || range.start.line !== range.end.line;
}

/**
 * 方法：resolveExpressionCached
 * 说明：执行 resolveExpressionCached 相关处理逻辑。
 * @param expression 参数 expression。
 * @param variables 参数 variables。
 * @param cache 参数 cache。
 * @returns 返回 EvalResult 类型结果。
 * 返回值示例：const result = resolveExpressionCached('demo-value', { token: 'abc' }, new Map()); // { ok: true }
 */
function resolveExpressionCached(
  expression: string,
  variables: VariableScope,
  cache: Map<string, EvalResult>
): EvalResult {
  // 变量：key，用于存储key。
  const key = expression.trim();
  // 变量：cached，用于存储cached。
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  // 变量：resolved，用于存储resolved。
  const resolved = resolveRenderExpression(key, variables);
  // 变量：result，用于存储result。
  const result = resolved.kind === "resolved" ? resolved.value : UNRESOLVED;
  cache.set(key, result);
  return result;
}

/**
 * 方法：createInlineResolvedOption
 * 说明：执行 createInlineResolvedOption 相关处理逻辑。
 * @param range 参数 range。
 * @param expression 参数 expression。
 * @param rendered 参数 rendered。
 * @returns 返回 vscode.DecorationOptions 类型结果。
 * 返回值示例：const result = createInlineResolvedOption(range, 'demo-value', 'demo-value'); // { ok: true }
 */
function createInlineResolvedOption(
  range: vscode.Range,
  expression: string,
  rendered: string
): vscode.DecorationOptions {
  // 变量：hiddenLength，用于存储hiddenlength。
  const hiddenLength = Math.max(1, range.end.character - range.start.character);
  return {
    range: new vscode.Range(range.end, range.end),
    hoverMessage: new vscode.MarkdownString([
      `**变量表达式**: \`${expression}\``,
      `**当前值**: \`${rendered}\``
    ].join("\n\n")),
    renderOptions: {
      before: {
        contentText: rendered,
        margin: `0 0 0 -${hiddenLength}ch`,
        color: new vscode.ThemeColor("editorCodeLens.foreground")
      }
    }
  };
}
