import * as vscode from 'vscode';
import { vhtMockVariables } from '../../env';
import { VhtAST } from './types';

export function getVariableCompletions(
    document: vscode.TextDocument,
    position: vscode.Position,
    ast: VhtAST
): vscode.CompletionItem[] {
    const context = getVariableContext(document, position, ast);
    if (!context) return [];

    const range = new vscode.Range(position.line, context.start, position.line, position.character);
    const suggestions = buildVariableSuggestions(vhtMockVariables);
    const lowerPrefix = context.prefix.toLowerCase();

    return suggestions
        .filter(item => item.label.toLowerCase().includes(lowerPrefix))
        .map(item => {
            const completion = new vscode.CompletionItem(item.label, vscode.CompletionItemKind.Variable);
            completion.insertText = item.insertText;
            completion.detail = item.detail;
            completion.range = range;
            return completion;
        });
}

function getVariableContext(
    document: vscode.TextDocument,
    position: vscode.Position,
    ast: VhtAST
): { start: number; prefix: string } | undefined {
    const variable = ast.variables.find(item => isPositionInRange(position, toVsRange(item.range)));
    if (!variable) return undefined;

    const range = toVsRange(variable.range);
    if (range.start.line !== range.end.line || position.line !== range.start.line) {
        return undefined;
    }

    const innerStart = range.start.character + 2;
    const innerEnd = Math.max(innerStart, range.end.character - 2);
    if (position.character < innerStart || position.character > innerEnd) {
        return undefined;
    }

    const rawPrefix = document.lineAt(position.line).text.slice(innerStart, position.character);
    const prefix = rawPrefix.trimStart();
    const leadingSpaces = rawPrefix.length - prefix.length;

    return {
        start: innerStart + leadingSpaces,
        prefix
    };
}

function buildVariableSuggestions(vars: Record<string, unknown>): Array<{ label: string; insertText: string; detail: string }> {
    const output: Array<{ label: string; insertText: string; detail: string }> = [];

    for (const [key, value] of Object.entries(vars)) {
        output.push({
            label: key,
            insertText: key,
            detail: '变量'
        });

        if (isPlainObject(value)) {
            for (const childKey of Object.keys(value)) {
                output.push({
                    label: `${key}.${childKey}`,
                    insertText: `${key}.${childKey}`,
                    detail: '变量路径'
                });
                output.push({
                    label: `${key}['${childKey}']`,
                    insertText: `${key}['${childKey}']`,
                    detail: '变量索引路径'
                });
            }
        }
    }

    return output;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toVsRange(range: { start: { line: number; character: number }; end: { line: number; character: number } }): vscode.Range {
    return new vscode.Range(range.start.line, range.start.character, range.end.line, range.end.character);
}

function isPositionInRange(position: vscode.Position, range: vscode.Range): boolean {
    if (position.line < range.start.line || position.line > range.end.line) return false;
    if (position.line === range.start.line && position.character < range.start.character) return false;
    if (position.line === range.end.line && position.character > range.end.character) return false;
    return true;
}
