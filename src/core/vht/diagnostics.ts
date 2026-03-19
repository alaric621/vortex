import * as vscode from 'vscode';
import { getVhtVariables } from '../../env';
import { Range as VhtRange } from './types';
import { collectDiagnosticIssues } from './diagnosticsRules';
import { VhtDiagnosticIssue } from './diagnosticsRules/types';
import { DocumentAstCache } from './documentAstCache';

export class VhtDiagnostics {
    private readonly collection: vscode.DiagnosticCollection;
    private readonly timers: Map<string, NodeJS.Timeout>;

    constructor(private readonly astCache: DocumentAstCache = new DocumentAstCache()) {
        // 在编辑器“问题”面板中显示的分类名称
        this.collection = vscode.languages.createDiagnosticCollection('vht-linter');
        this.timers = new Map();
    }

    public scheduleUpdate(document: vscode.TextDocument, delayMs: number = 120) {
        if (document.languageId !== 'vht') return;

        const key = document.uri.toString();
        const existing = this.timers.get(key);
        if (existing) {
            clearTimeout(existing);
        }

        const timer = setTimeout(() => {
            this.timers.delete(key);
            this.update(document);
        }, delayMs);

        this.timers.set(key, timer);
    }

    /**
     * 主更新逻辑：解析文本并同步错误到 VS Code
     */
    public update(document: vscode.TextDocument) {
        if (document.languageId !== 'vht') return;

        const text = document.getText();
        const ast = this.astCache.get(document);
        const ruleIssues = collectDiagnosticIssues(ast, text, getVhtVariables(document.uri));

        const parserDiagnostics = ast.errors.map(err => this.createParserDiagnostic(err.range, err.message));
        const ruleDiagnostics = ruleIssues.map(issue => this.createRuleDiagnostic(issue));
        const diagnostics = [...parserDiagnostics, ...ruleDiagnostics];

        // 更新当前文档的错误集合
        this.collection.set(document.uri, diagnostics);
    }

    /**
     * 当文档关闭时，清除该文档的所有错误记录
     */
    public clear(document: vscode.TextDocument) {
        const key = document.uri.toString();
        const existing = this.timers.get(key);
        if (existing) {
            clearTimeout(existing);
            this.timers.delete(key);
        }
        this.astCache.delete(document);
        this.collection.delete(document.uri);
    }

    /**
     * 辅助工具：将 AST 内部的 Range 转换为 vscode.Range
     */
    private toVsCodeRange(range: VhtRange): vscode.Range {
        return new vscode.Range(
            range.start.line,
            range.start.character,
            range.end.line,
            range.end.character
        );
    }

    private createParserDiagnostic(range: VhtRange, message: string): vscode.Diagnostic {
        const diagnostic = new vscode.Diagnostic(
            this.toVsCodeRange(range),
            message,
            vscode.DiagnosticSeverity.Error
        );
        diagnostic.source = 'VHT Parser';

        if (message.includes('空行')) {
            diagnostic.code = 'missing-blank-line';
        } else if (message.includes('Header')) {
            diagnostic.code = 'invalid-header';
        }

        return diagnostic;
    }

    private createRuleDiagnostic(issue: VhtDiagnosticIssue): vscode.Diagnostic {
        const diagnostic = new vscode.Diagnostic(
            this.toVsCodeRange(issue.range),
            issue.message,
            this.toSeverity(issue.severity)
        );
        diagnostic.code = issue.code;
        diagnostic.source = issue.source ?? 'VHT Rules';
        return diagnostic;
    }

    private toSeverity(severity: VhtDiagnosticIssue['severity']): vscode.DiagnosticSeverity {
        if (severity === 'error') return vscode.DiagnosticSeverity.Error;
        if (severity === 'warning') return vscode.DiagnosticSeverity.Warning;
        return vscode.DiagnosticSeverity.Information;
    }

    public getCollection() {
        return this.collection;
    }
}
