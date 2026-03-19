import * as vscode from 'vscode';
import { getVhtVariables } from '../../env';
import { VhtAST } from './types';
import { resolveVariableExpression } from './variableExpression';

export function getVariableCompletions(
    document: vscode.TextDocument,
    position: vscode.Position,
    ast: VhtAST
): vscode.CompletionItem[] {
    const context = getVariableContext(document, position, ast);
    if (!context) return [];

    return buildCompletionsByJsLikeContext(context, document, position, getVhtVariables(document.uri));
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

function buildCompletionsByJsLikeContext(
    context: { start: number; prefix: string },
    document: vscode.TextDocument,
    position: vscode.Position,
    variables: Record<string, unknown>
): vscode.CompletionItem[] {
    const dotContext = context.prefix.match(/^(.*)\.([A-Za-z_$][\w$]*)?$/);
    if (dotContext) {
        const baseExpr = dotContext[1].trim();
        const propertyPrefix = dotContext[2] ?? '';
        const resolved = resolveExpressionValue(baseExpr, variables);
        if (resolved.found) {
            const candidates = buildPropertySuggestions(resolved.value);
            return toCompletionItems(
                candidates,
                new vscode.Range(
                    position.line,
                    position.character - propertyPrefix.length,
                    position.line,
                    position.character
                ),
                propertyPrefix
            );
        }
        return [];
    }

    const bracketContext = context.prefix.match(/^(.*)\[['"]([^'"]*)$/);
    if (bracketContext) {
        const baseExpr = bracketContext[1].trim();
        const keyPrefix = bracketContext[2] ?? '';
        const resolved = resolveExpressionValue(baseExpr, variables);
        if (resolved.found && isPlainObject(resolved.value)) {
            const lineText = document.lineAt(position.line).text;
            const tail = lineText.slice(position.character);
            const hasClosingBracket = tail.startsWith("']") || tail.startsWith('"]');
            const candidates = Object.keys(resolved.value).map(key => ({
                label: key,
                insertText: hasClosingBracket ? key : `${key}']`,
                detail: '对象键'
            }));
            return toCompletionItems(
                candidates,
                new vscode.Range(
                    position.line,
                    position.character - keyPrefix.length,
                    position.line,
                    position.character
                ),
                keyPrefix
            );
        }
        return [];
    }

    const rootSuggestions = [
        ...buildRootVariableSuggestions(variables),
        { label: 'true', insertText: 'true', detail: 'JS 关键字' },
        { label: 'false', insertText: 'false', detail: 'JS 关键字' },
        { label: 'null', insertText: 'null', detail: 'JS 关键字' },
        { label: 'undefined', insertText: 'undefined', detail: 'JS 关键字' }
    ];

    return toCompletionItems(
        rootSuggestions,
        new vscode.Range(position.line, context.start, position.line, position.character),
        context.prefix
    );
}

function buildRootVariableSuggestions(vars: Record<string, unknown>): Array<{ label: string; insertText: string; detail: string }> {
    return Object.keys(vars).map(key => ({
        label: key,
        insertText: key,
        detail: '变量'
    }));
}

function buildPropertySuggestions(value: unknown): Array<{ label: string; insertText: string; detail: string }> {
    const output: Array<{ label: string; insertText: string; detail: string }> = [];

    if (isPlainObject(value)) {
        for (const key of Object.keys(value)) {
            output.push({ label: key, insertText: key, detail: '对象属性' });
        }
    }

    const prototypeMethods = getPrototypePropertyNames(value);
    for (const name of prototypeMethods) {
        output.push({
            label: name,
            insertText: `${name}${looksLikeFunction(value, name) ? '()' : ''}`,
            detail: 'JS 属性/方法'
        });
    }

    return dedupeByLabel(output);
}

function getPrototypePropertyNames(value: unknown): string[] {
    if (value === null || value === undefined) return [];

    const boxed = typeof value === 'object' ? value : Object(value);
    const names = new Set<string>();
    let proto = Object.getPrototypeOf(boxed);
    let depth = 0;

    while (proto && depth < 3) {
        for (const name of Object.getOwnPropertyNames(proto)) {
            if (name === 'constructor') continue;
            names.add(name);
        }
        proto = Object.getPrototypeOf(proto);
        depth++;
    }
    return Array.from(names);
}

function looksLikeFunction(value: unknown, name: string): boolean {
    if (value === null || value === undefined) return false;
    const boxed = typeof value === 'object' ? value : Object(value);
    const prop = (boxed as Record<string, unknown>)[name];
    return typeof prop === 'function';
}

function resolveExpressionValue(expression: string, vars: Record<string, unknown>): { found: boolean; value?: unknown } {
    const resolved = resolveVariableExpression(expression, vars);
    if (resolved.kind !== "resolved") {
        return { found: false };
    }

    return { found: true, value: resolved.value };
}

function toCompletionItems(
    source: Array<{ label: string; insertText: string; detail: string }>,
    range: vscode.Range,
    prefix: string
): vscode.CompletionItem[] {
    const lowerPrefix = prefix.toLowerCase();
    return source
        .filter(item => item.label.toLowerCase().includes(lowerPrefix))
        .map(item => {
            const completion = new vscode.CompletionItem(item.label, vscode.CompletionItemKind.Property);
            completion.insertText = item.insertText;
            completion.detail = item.detail;
            completion.range = range;
            return completion;
        });
}

function dedupeByLabel(items: Array<{ label: string; insertText: string; detail: string }>): Array<{ label: string; insertText: string; detail: string }> {
    const seen = new Set<string>();
    const output: Array<{ label: string; insertText: string; detail: string }> = [];
    for (const item of items) {
        if (seen.has(item.label)) continue;
        seen.add(item.label);
        output.push(item);
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
