import * as vscode from 'vscode';
import { getVhtVariables } from '../../context';
import { rangeContainsPosition, toVsCodeRange } from '../../utils/range';
import { VhtAST } from './types';
import { resolveVariableExpression } from './variableExpression';

type CompletionSuggestion = { label: string; insertText: string; detail: string };

/**
 * 方法：getVariableCompletions
 * 说明：执行 getVariableCompletions 相关处理逻辑。
 * @param document 参数 document。
 * @param position 参数 position。
 * @param ast 参数 ast。
 * @returns 返回 vscode.CompletionItem[] 列表。
 * 返回值示例：const list = getVariableCompletions(document, position, ast); // [{ id: 'demo' }]
 */
export function getVariableCompletions(
    document: vscode.TextDocument,
    position: vscode.Position,
    ast: VhtAST
): vscode.CompletionItem[] {
    // 变量：context，用于存储context。
    const context = getVariableContext(document, position, ast);
    if (!context) return [];

    return buildCompletionsByJsLikeContext(context, document, position, getVhtVariables(document.uri));
}

/**
 * 方法：getVariableContext
 * 说明：执行 getVariableContext 相关处理逻辑。
 * @param document 参数 document。
 * @param position 参数 position。
 * @param ast 参数 ast。
 * @returns 命中时返回 { start: number; prefix: string }，未命中时返回 undefined。
 * 返回值示例：const result = getVariableContext(document, position, ast); // { ok: true } 或 undefined
 */
function getVariableContext(
    document: vscode.TextDocument,
    position: vscode.Position,
    ast: VhtAST
): { start: number; prefix: string } | undefined {
    // 变量：variable，用于存储变量。
    const variable = ast.variables.find(item => rangeContainsPosition(toVsCodeRange(item.range), position));
    if (!variable) return undefined;

    // 变量：range，用于存储范围。
    const range = toVsCodeRange(variable.range);
    if (range.start.line !== range.end.line || position.line !== range.start.line) {
        return undefined;
    }

    // 变量：innerStart，用于存储innerstart。
    const innerStart = range.start.character + 2;
    // 变量：innerEnd，用于存储innerend。
    const innerEnd = Math.max(innerStart, range.end.character - 2);
    if (position.character < innerStart || position.character > innerEnd) {
        return undefined;
    }

    // 变量：rawPrefix，用于存储rawprefix。
    const rawPrefix = document.lineAt(position.line).text.slice(innerStart, position.character);
    // 变量：prefix，用于存储prefix。
    const prefix = rawPrefix.trimStart();
    // 变量：leadingSpaces，用于存储leadingspaces。
    const leadingSpaces = rawPrefix.length - prefix.length;

    return {
        start: innerStart + leadingSpaces,
        prefix
    };
}

/**
 * 方法：buildCompletionsByJsLikeContext
 * 说明：执行 buildCompletionsByJsLikeContext 相关处理逻辑。
 * @param context 参数 context。
 * @param document 参数 document。
 * @param position 参数 position。
 * @param variables 参数 variables。
 * @returns 返回 vscode.CompletionItem[] 列表。
 * 返回值示例：const list = buildCompletionsByJsLikeContext({ ... }, document, position, { token: 'abc' }); // [{ id: 'demo' }]
 */
function buildCompletionsByJsLikeContext(
    context: { start: number; prefix: string },
    document: vscode.TextDocument,
    position: vscode.Position,
    variables: Record<string, unknown>
): vscode.CompletionItem[] {
    return (
        getDotCompletions(context.prefix, position, variables)
        ?? getBracketCompletions(context.prefix, document, position, variables)
        ?? getRootCompletions(context, position, variables)
    );
}

/**
 * 方法：buildRootVariableSuggestions
 * 说明：执行 buildRootVariableSuggestions 相关处理逻辑。
 * @param vars 参数 vars。
 * @returns 返回 CompletionSuggestion[] 列表。
 * 返回值示例：const list = buildRootVariableSuggestions({ token: 'abc' }); // [{ id: 'demo' }]
 */
function buildRootVariableSuggestions(vars: Record<string, unknown>): CompletionSuggestion[] {
    return Object.keys(vars).map(key => ({
        label: key,
        insertText: key,
        detail: '变量'
    }));
}

/**
 * 方法：buildPropertySuggestions
 * 说明：执行 buildPropertySuggestions 相关处理逻辑。
 * @param value 参数 value。
 * @returns 返回 CompletionSuggestion[] 列表。
 * 返回值示例：const list = buildPropertySuggestions({ ok: true }); // [{ id: 'demo' }]
 */
function buildPropertySuggestions(value: unknown): CompletionSuggestion[] {
    // 变量：output，用于存储输出。
    const output: CompletionSuggestion[] = [];

    if (isPlainObject(value)) {
        for (const key of Object.keys(value)) {
            output.push({ label: key, insertText: key, detail: '对象属性' });
        }
    }

    // 变量：prototypeMethods，用于存储prototypemethods。
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

/**
 * 方法：getPrototypePropertyNames
 * 说明：执行 getPrototypePropertyNames 相关处理逻辑。
 * @param value 参数 value。
 * @returns 返回 string[] 列表。
 * 返回值示例：const list = getPrototypePropertyNames({ ok: true }); // [{ id: 'demo' }]
 */
function getPrototypePropertyNames(value: unknown): string[] {
    if (value === null || value === undefined) return [];

    // 变量：boxed，用于存储boxed。
    const boxed = typeof value === 'object' ? value : Object(value);
    // 变量：names，用于存储names。
    const names = new Set<string>();
    // 变量：proto，用于存储proto。
    let proto = Object.getPrototypeOf(boxed);
    // 变量：depth，用于存储depth。
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

/**
 * 方法：looksLikeFunction
 * 说明：执行 looksLikeFunction 相关处理逻辑。
 * @param value 参数 value。
 * @param name 参数 name。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = looksLikeFunction({ ok: true }, 'demo-value'); // true
 */
function looksLikeFunction(value: unknown, name: string): boolean {
    if (value === null || value === undefined) return false;
    // 变量：boxed，用于存储boxed。
    const boxed = typeof value === 'object' ? value : Object(value);
    // 变量：prop，用于存储prop。
    const prop = (boxed as Record<string, unknown>)[name];
    return typeof prop === 'function';
}

/**
 * 方法：resolveExpressionValue
 * 说明：执行 resolveExpressionValue 相关处理逻辑。
 * @param expression 参数 expression。
 * @param vars 参数 vars。
 * @returns 返回 { found: boolean; value?: unknown } 类型结果。
 * 返回值示例：const result = resolveExpressionValue('demo-value', { token: 'abc' }); // { ok: true }
 */
function resolveExpressionValue(expression: string, vars: Record<string, unknown>): { found: boolean; value?: unknown } {
    // 变量：resolved，用于存储resolved。
    const resolved = resolveVariableExpression(expression, vars);
    if (resolved.kind !== "resolved") {
        return { found: false };
    }

    return { found: true, value: resolved.value };
}

/**
 * 方法：toCompletionItems
 * 说明：执行 toCompletionItems 相关处理逻辑。
 * @param source 参数 source。
 * @param range 参数 range。
 * @param prefix 参数 prefix。
 * @returns 返回 vscode.CompletionItem[] 列表。
 * 返回值示例：const list = toCompletionItems([], range, 'demo-value'); // [{ id: 'demo' }]
 */
function toCompletionItems(
    source: CompletionSuggestion[],
    range: vscode.Range,
    prefix: string
): vscode.CompletionItem[] {
    // 变量：lowerPrefix，用于存储lowerprefix。
    const lowerPrefix = prefix.toLowerCase();
    return source
        .filter(item => item.label.toLowerCase().includes(lowerPrefix))
        .map(item => {
            // 变量：completion，用于存储补全。
            const completion = new vscode.CompletionItem(item.label, vscode.CompletionItemKind.Property);
            completion.insertText = item.insertText;
            completion.detail = item.detail;
            completion.range = range;
            return completion;
        });
}

/**
 * 方法：getDotCompletions
 * 说明：执行 getDotCompletions 相关处理逻辑。
 * @param prefix 参数 prefix。
 * @param position 参数 position。
 * @param variables 参数 variables。
 * @returns 命中时返回 vscode.CompletionItem[]，未命中时返回 undefined。
 * 返回值示例：const result = getDotCompletions('demo-value', position, { token: 'abc' }); // [{ id: 'demo' }] 或 undefined
 */
function getDotCompletions(
    prefix: string,
    position: vscode.Position,
    variables: Record<string, unknown>
): vscode.CompletionItem[] | undefined {
    // 变量：match，用于存储match。
    const match = prefix.match(/^(.*)\.([A-Za-z_$][\w$]*)?$/);
    if (!match) {
        return undefined;
    }

    // 变量：resolved，用于存储resolved。
    const resolved = resolveExpressionValue(match[1].trim(), variables);
    if (!resolved.found) {
        return [];
    }

    return toCompletionItems(
        buildPropertySuggestions(resolved.value),
        createReplaceRange(position, (match[2] ?? '').length),
        match[2] ?? ''
    );
}

/**
 * 方法：getBracketCompletions
 * 说明：执行 getBracketCompletions 相关处理逻辑。
 * @param prefix 参数 prefix。
 * @param document 参数 document。
 * @param position 参数 position。
 * @param variables 参数 variables。
 * @returns 命中时返回 vscode.CompletionItem[]，未命中时返回 undefined。
 * 返回值示例：const result = getBracketCompletions('demo-value', document, position, { token: 'abc' }); // [{ id: 'demo' }] 或 undefined
 */
function getBracketCompletions(
    prefix: string,
    document: vscode.TextDocument,
    position: vscode.Position,
    variables: Record<string, unknown>
): vscode.CompletionItem[] | undefined {
    // 变量：match，用于存储match。
    const match = prefix.match(/^(.*)\[['"]([^'"]*)$/);
    if (!match) {
        return undefined;
    }

    // 变量：resolved，用于存储resolved。
    const resolved = resolveExpressionValue(match[1].trim(), variables);
    if (!resolved.found || !isPlainObject(resolved.value)) {
        return [];
    }

    return toCompletionItems(
        buildBracketKeySuggestions(resolved.value, document, position),
        createReplaceRange(position, (match[2] ?? '').length),
        match[2] ?? ''
    );
}

/**
 * 方法：getRootCompletions
 * 说明：执行 getRootCompletions 相关处理逻辑。
 * @param context 参数 context。
 * @param position 参数 position。
 * @param variables 参数 variables。
 * @returns 返回 vscode.CompletionItem[] 列表。
 * 返回值示例：const list = getRootCompletions({ ... }, position, { token: 'abc' }); // [{ id: 'demo' }]
 */
function getRootCompletions(
    context: { start: number; prefix: string },
    position: vscode.Position,
    variables: Record<string, unknown>
): vscode.CompletionItem[] {
    return toCompletionItems(
        [
            ...buildRootVariableSuggestions(variables),
            { label: 'true', insertText: 'true', detail: 'JS 关键字' },
            { label: 'false', insertText: 'false', detail: 'JS 关键字' },
            { label: 'null', insertText: 'null', detail: 'JS 关键字' },
            { label: 'undefined', insertText: 'undefined', detail: 'JS 关键字' }
        ],
        new vscode.Range(position.line, context.start, position.line, position.character),
        context.prefix
    );
}

/**
 * 方法：buildBracketKeySuggestions
 * 说明：执行 buildBracketKeySuggestions 相关处理逻辑。
 * @param value 参数 value。
 * @param document 参数 document。
 * @param position 参数 position。
 * @returns 返回 CompletionSuggestion[] 列表。
 * 返回值示例：const list = buildBracketKeySuggestions({ token: 'abc' }, document, position); // [{ id: 'demo' }]
 */
function buildBracketKeySuggestions(
    value: Record<string, unknown>,
    document: vscode.TextDocument,
    position: vscode.Position
): CompletionSuggestion[] {
    // 变量：tail，用于存储tail。
    const tail = document.lineAt(position.line).text.slice(position.character);
    // 变量：hasClosingBracket，用于存储hasclosingbracket。
    const hasClosingBracket = tail.startsWith("']") || tail.startsWith('"]');

    return Object.keys(value).map(key => ({
        label: key,
        insertText: hasClosingBracket ? key : `${key}']`,
        detail: '对象键'
    }));
}

/**
 * 方法：createReplaceRange
 * 说明：执行 createReplaceRange 相关处理逻辑。
 * @param position 参数 position。
 * @param prefixLength 参数 prefixLength。
 * @returns 返回 vscode.Range 类型结果。
 * 返回值示例：const result = createReplaceRange(position, 1); // { ok: true }
 */
function createReplaceRange(position: vscode.Position, prefixLength: number): vscode.Range {
    return new vscode.Range(
        position.line,
        position.character - prefixLength,
        position.line,
        position.character
    );
}

/**
 * 方法：dedupeByLabel
 * 说明：执行 dedupeByLabel 相关处理逻辑。
 * @param items 参数 items。
 * @returns 返回 CompletionSuggestion[] 列表。
 * 返回值示例：const list = dedupeByLabel([]); // [{ id: 'demo' }]
 */
function dedupeByLabel(items: CompletionSuggestion[]): CompletionSuggestion[] {
    // 变量：seen，用于存储seen。
    const seen = new Set<string>();
    // 变量：output，用于存储输出。
    const output: CompletionSuggestion[] = [];
    for (const item of items) {
        if (seen.has(item.label)) continue;
        seen.add(item.label);
        output.push(item);
    }
    return output;
}

/**
 * 方法：isPlainObject
 * 说明：执行 isPlainObject 相关处理逻辑。
 * @param value 参数 value。
 * @returns 返回 value is Record<string, unknown> 类型结果。
 * 返回值示例：const result = isPlainObject({ ok: true }); // { ok: true }
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
