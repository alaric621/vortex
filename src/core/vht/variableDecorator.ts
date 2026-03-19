import * as vscode from 'vscode';
import { VhtParser } from './parser';
import { VhtAST } from './types';
import { vhtMockVariables } from '../../env';

type VariableScope = Record<string, unknown>;
type EvalResult = unknown | typeof UNRESOLVED;

interface AstCacheEntry {
    version: number;
    ast: VhtAST;
}

const UNRESOLVED = Symbol('UNRESOLVED');

export class VariableDecorator implements vscode.Disposable {
    private readonly parser: VhtParser;
    private readonly hiddenExpressionDecoration: vscode.TextEditorDecorationType;
    private readonly inlineResolvedDecoration: vscode.TextEditorDecorationType;
    private readonly errorDecoration: vscode.TextEditorDecorationType;
    private readonly mockVariables: VariableScope;
    private readonly astCache: Map<string, AstCacheEntry>;
    private readonly evalCache: Map<string, EvalResult>;

    constructor() {
        this.parser = new VhtParser();
        this.astCache = new Map();
        this.evalCache = new Map();
        // TODO: 后续替换为真实变量来源（vortex.json activeEnvironment variables）
        this.mockVariables = vhtMockVariables;

        this.hiddenExpressionDecoration = vscode.window.createTextEditorDecorationType({
            color: 'transparent'
        });
        this.inlineResolvedDecoration = vscode.window.createTextEditorDecorationType({});

        this.errorDecoration = vscode.window.createTextEditorDecorationType({
            border: '1px dotted',
            borderColor: new vscode.ThemeColor('editorError.foreground')
        });
    }

    public update(editor?: vscode.TextEditor): void {
        const target = editor ?? vscode.window.activeTextEditor;
        if (!target) return;
        if (target.document.languageId !== 'vht') return;

        const ast = this.getOrParseAst(target.document);
        const hiddenExpressionRanges: vscode.Range[] = [];
        const inlineResolvedOptions: vscode.DecorationOptions[] = [];
        const errorRanges: vscode.Range[] = [];
        const activePosition = target.selection.active;

        for (const variable of ast.variables) {
            const fullRange = this.toVsCodeRange(variable.range);
            if (this.containsPosition(fullRange, activePosition)) {
                // 光标位于变量中时，显示原始内容，方便直接编辑。
                continue;
            }
            const resolved = this.resolveExpressionCached(variable.expression);
            if (resolved === UNRESOLVED) {
                errorRanges.push(fullRange);
                continue;
            }

            if (fullRange.start.line !== fullRange.end.line) {
                // 跨行变量容易造成装饰错位，默认不做可视替换，避免换行污染显示。
                continue;
            }

            const rendered = String(resolved);
            hiddenExpressionRanges.push(fullRange);
            const hiddenLength = Math.max(1, fullRange.end.character - fullRange.start.character);
            inlineResolvedOptions.push({
                range: new vscode.Range(fullRange.end, fullRange.end),
                hoverMessage: new vscode.MarkdownString([
                    `**变量表达式**: \`${variable.expression}\``,
                    `**当前值**: \`${rendered}\``
                ].join('\n\n')),
                renderOptions: {
                    before: {
                        contentText: rendered,
                        margin: `0 0 0 -${hiddenLength}ch`,
                        color: new vscode.ThemeColor('editorCodeLens.foreground')
                    }
                }
            });
        }

        target.setDecorations(this.hiddenExpressionDecoration, hiddenExpressionRanges);
        target.setDecorations(this.inlineResolvedDecoration, inlineResolvedOptions);
        target.setDecorations(this.errorDecoration, errorRanges);
    }

    public dispose(): void {
        this.hiddenExpressionDecoration.dispose();
        this.inlineResolvedDecoration.dispose();
        this.errorDecoration.dispose();
        this.astCache.clear();
        this.evalCache.clear();
    }

    private getOrParseAst(document: vscode.TextDocument): VhtAST {
        const key = document.uri.toString();
        const cached = this.astCache.get(key);
        if (cached && cached.version === document.version) {
            return cached.ast;
        }

        const ast = this.parser.parse(document.getText());
        this.astCache.set(key, { version: document.version, ast });
        return ast;
    }

    private resolveExpressionCached(expression: string): EvalResult {
        const cacheKey = expression.trim();
        const cached = this.evalCache.get(cacheKey);
        if (cached !== undefined) {
            return cached;
        }

        const value = this.resolveExpression(cacheKey);
        const result = value === undefined ? UNRESOLVED : value;
        this.evalCache.set(cacheKey, result);
        return result;
    }

    private resolveExpression(expression: string): unknown {
        if (!expression) return undefined;
        try {
            // 受控变量对象 + 函数构造器，支持 client['api'] / name / 可选链等表达式
            const fn = new Function(
                'vars',
                `with (vars) { return (${expression}); }`
            ) as (vars: VariableScope) => unknown;

            return fn(this.mockVariables);
        } catch {
            return undefined;
        }
    }

    private toVsCodeRange(range: { start: { line: number; character: number }; end: { line: number; character: number } }): vscode.Range {
        return new vscode.Range(
            range.start.line,
            range.start.character,
            range.end.line,
            range.end.character
        );
    }

    private containsPosition(range: vscode.Range, position: vscode.Position): boolean {
        return position.line >= range.start.line
            && position.line <= range.end.line
            && (position.line !== range.start.line || position.character >= range.start.character)
            && (position.line !== range.end.line || position.character <= range.end.character);
    }
}
