import * as vscode from "vscode";
import type { AST, VariableNode } from "../engine/parser/types";
import { resolveRenderExpression } from "../../template/render";
import { rangeContainsPosition, toVsCodeRange } from "../../../utils/range";

type VariableScope = Record<string, unknown>;
type EvalResult = unknown | typeof UNRESOLVED;

const UNRESOLVED = Symbol("UNRESOLVED");

export interface DecorationPayload {
  hiddenRanges: vscode.Range[];
  inlineOptions: vscode.DecorationOptions[];
  errorRanges: vscode.Range[];
}

export function buildVariableDecorations(
  ast: AST,
  variables: VariableScope,
  activePosition: vscode.Position
): DecorationPayload {
  const expressionCache = new Map<string, EvalResult>();
  const hiddenRanges: vscode.Range[] = [];
  const inlineOptions: vscode.DecorationOptions[] = [];
  const errorRanges: vscode.Range[] = [];

  for (const variable of ast.variables) {
    const range = toVsCodeRange(variable.range);
    if (shouldSkipRange(range, activePosition)) {
      continue;
    }

    const resolved = resolveExpressionCached(variable.expression, variables, expressionCache);
    if (resolved === UNRESOLVED) {
      errorRanges.push(range);
      continue;
    }

    hiddenRanges.push(range);
    inlineOptions.push(createInlineResolvedOption(range, variable.expression, String(resolved)));
  }

  return { hiddenRanges, inlineOptions, errorRanges };
}

export function buildAstFromVariables(variables: VariableNode[]): AST {
  return {
    nodes: [],
    errors: [],
    sections: {
      headers: [],
      scripts: {}
    },
    variables
  };
}

function resolveExpressionCached(
  expression: string,
  scope: VariableScope,
  cache: Map<string, EvalResult>
): EvalResult {
  const cached = cache.get(expression);
  if (cached !== undefined) {
    return cached;
  }

  const resolved = resolveRenderExpression(expression, scope);
  const value = resolved.kind === "resolved" ? resolved.value : UNRESOLVED;
  cache.set(expression, value);
  return value;
}

function shouldSkipRange(range: vscode.Range, activePosition: vscode.Position): boolean {
  if (!rangeContainsPosition(range, activePosition)) {
    return false;
  }

  const endPosition = range.end;
  if (activePosition.line !== endPosition.line) {
    return false;
  }

  return activePosition.character <= endPosition.character;
}

function createInlineResolvedOption(range: vscode.Range, raw: string, rendered: string): vscode.DecorationOptions {
  return {
    range,
    hoverMessage: createInlineHover(raw, rendered),
    renderOptions: {
      after: {
        contentText: rendered,
        margin: "0 0 0 12px",
        color: new vscode.ThemeColor("editorCodeLens.foreground")
      }
    }
  };
}

function createInlineHover(raw: string, rendered: string): vscode.MarkdownString {
  const hover = new vscode.MarkdownString();
  hover.isTrusted = false;
  hover.appendMarkdown(`**表达式**: \`${raw}\`\n\n`);
  hover.appendMarkdown(`**当前值**: \`${rendered}\``);
  return hover;
}
