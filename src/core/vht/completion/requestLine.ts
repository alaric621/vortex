import * as vscode from 'vscode';
import { ASTNode, VhtAST } from '../parser/types';

// 变量：REQUEST_METHODS，用于存储请求methods。
const REQUEST_METHODS = [
    'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'CONNECT', 'TRACE',
    'WEBSOCKET', 'SSE', 'EVENTSOURCE', 'SUBSCRIBE', 'UNSUBSCRIBE'
];

// 变量：PROTOCOL_SCHEMES，用于存储protocolschemes。
const PROTOCOL_SCHEMES = ['http://', 'https://', 'ws://', 'wss://'];
// 变量：HTTP_VERSIONS，用于存储httpversions。
const HTTP_VERSIONS = ['HTTP/1.0', 'HTTP/1.1', 'HTTP/2', 'HTTP/3'];

/**
 * 方法：isInRequestLine
 * 说明：执行 isInRequestLine 相关处理逻辑。
 * @param document 参数 document。
 * @param ast 参数 ast。
 * @param position 参数 position。
 * @param nodeAtCursor 参数 nodeAtCursor。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = isInRequestLine(document, ast, position, { ... }); // true
 */
export function isInRequestLine(
    document: vscode.TextDocument,
    ast: VhtAST,
    position: vscode.Position,
    nodeAtCursor?: ASTNode
): boolean {
    if (nodeAtCursor?.type === 'RequestLine') {
        return true;
    }

    // 变量：requestNode，用于存储请求节点。
    const requestNode = ast.sections.request;
    if (requestNode) {
        return position.line === requestNode.range.start.line;
    }

    return position.line === 0 && document.lineAt(0).text.trim() !== '';
}

/**
 * 方法：getRequestLineCompletions
 * 说明：执行 getRequestLineCompletions 相关处理逻辑。
 * @param document 参数 document。
 * @param position 参数 position。
 * @param ast 参数 ast。
 * @returns 返回 vscode.CompletionItem[] 列表。
 * 返回值示例：const list = getRequestLineCompletions(document, position, ast); // [{ id: 'demo' }]
 */
export function getRequestLineCompletions(
    document: vscode.TextDocument,
    position: vscode.Position,
    ast: VhtAST
): vscode.CompletionItem[] {
    // 变量：lineText，用于存储行text。
    const lineText = document.lineAt(position.line).text;
    // 变量：linePrefix，用于存储行prefix。
    const linePrefix = lineText.slice(0, position.character);
    // 变量：tokenInfo，用于存储令牌info。
    const tokenInfo = getTokenInfo(linePrefix);
    // 变量：currentWordRange，用于存储currentword范围。
    const currentWordRange = getCurrentWordRange(lineText, position);

    // 变量：requestData，用于存储请求数据。
    const requestData = ast.sections.request?.data ?? {};
    // 变量：hasUrlInAst，用于存储has地址in语法树。
    const hasUrlInAst = typeof requestData.url === 'string' && requestData.url.length > 0;

    if (shouldSuggestMethod(tokenInfo)) {
        return createMethodCompletions(currentWordRange);
    }

    if (shouldSuggestVersion(tokenInfo, hasUrlInAst)) {
        return createVersionCompletions(currentWordRange);
    }

    return createSchemeCompletions(currentWordRange);
}

/**
 * 方法：createMethodCompletions
 * 说明：执行 createMethodCompletions 相关处理逻辑。
 * @param range 参数 range。
 * @returns 返回 vscode.CompletionItem[] 列表。
 * 返回值示例：const list = createMethodCompletions(range); // [{ id: 'demo' }]
 */
function createMethodCompletions(range: vscode.Range): vscode.CompletionItem[] {
    return REQUEST_METHODS.map(method => {
        // 变量：item，用于存储item。
        const item = new vscode.CompletionItem(method, vscode.CompletionItemKind.Keyword);
        item.insertText = new vscode.SnippetString(`${method} \${1:http://localhost}`);
        item.detail = 'HTTP Method';
        item.range = range;
        return item;
    });
}

/**
 * 方法：createSchemeCompletions
 * 说明：执行 createSchemeCompletions 相关处理逻辑。
 * @param range 参数 range。
 * @returns 返回 vscode.CompletionItem[] 列表。
 * 返回值示例：const list = createSchemeCompletions(range); // [{ id: 'demo' }]
 */
function createSchemeCompletions(range: vscode.Range): vscode.CompletionItem[] {
    return PROTOCOL_SCHEMES.map(scheme => {
        // 变量：item，用于存储item。
        const item = new vscode.CompletionItem(scheme, vscode.CompletionItemKind.Value);
        item.insertText = scheme;
        item.detail = 'URL Scheme';
        item.range = range;
        return item;
    });
}

/**
 * 方法：createVersionCompletions
 * 说明：执行 createVersionCompletions 相关处理逻辑。
 * @param range 参数 range。
 * @returns 返回 vscode.CompletionItem[] 列表。
 * 返回值示例：const list = createVersionCompletions(range); // [{ id: 'demo' }]
 */
function createVersionCompletions(range: vscode.Range): vscode.CompletionItem[] {
    return HTTP_VERSIONS.map(version => {
        // 变量：item，用于存储item。
        const item = new vscode.CompletionItem(version, vscode.CompletionItemKind.EnumMember);
        item.insertText = version;
        item.detail = 'HTTP Version';
        item.range = range;
        return item;
    });
}

/**
 * 方法：shouldSuggestMethod
 * 说明：执行 shouldSuggestMethod 相关处理逻辑。
 * @param tokenInfo 参数 tokenInfo。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = shouldSuggestMethod({ ... }); // true
 */
function shouldSuggestMethod(tokenInfo: { tokens: string[]; cursorInWhitespace: boolean }): boolean {
    return tokenInfo.tokens.length === 0 || (tokenInfo.tokens.length === 1 && !tokenInfo.cursorInWhitespace);
}

/**
 * 方法：shouldSuggestVersion
 * 说明：执行 shouldSuggestVersion 相关处理逻辑。
 * @param tokenInfo 参数 tokenInfo。
 * @param hasUrlInAst 参数 hasUrlInAst。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = shouldSuggestVersion({ ... }, true); // true
 */
function shouldSuggestVersion(
    tokenInfo: { tokens: string[]; cursorInWhitespace: boolean },
    hasUrlInAst: boolean
): boolean {
    if (tokenInfo.tokens.length >= 3) {
        return true;
    }

    return tokenInfo.tokens.length === 2
        && tokenInfo.cursorInWhitespace
        && (hasUrlInAst || tokenInfo.tokens[1].length > 0);
}

/**
 * 方法：getTokenInfo
 * 说明：执行 getTokenInfo 相关处理逻辑。
 * @param linePrefix 参数 linePrefix。
 * @returns 返回 { tokens: string[]; cursorInWhitespace: boolean } 类型结果。
 * 返回值示例：const result = getTokenInfo('demo-value'); // { ok: true }
 */
function getTokenInfo(linePrefix: string): { tokens: string[]; cursorInWhitespace: boolean } {
    // 变量：tokens，用于存储tokens。
    const tokens: string[] = [];
    // 变量：tokenStart，用于存储令牌start。
    let tokenStart = -1;

    for (let i = 0; i < linePrefix.length; i++) {
        if (isWhitespace(linePrefix[i])) {
            if (tokenStart >= 0) {
                tokens.push(linePrefix.slice(tokenStart, i));
                tokenStart = -1;
            }
        } else if (tokenStart === -1) {
            tokenStart = i;
        }
    }

    if (tokenStart >= 0) {
        tokens.push(linePrefix.slice(tokenStart));
    }

    return {
        tokens,
        cursorInWhitespace: linePrefix.length > 0 && isWhitespace(linePrefix[linePrefix.length - 1])
    };
}

/**
 * 方法：getCurrentWordRange
 * 说明：执行 getCurrentWordRange 相关处理逻辑。
 * @param lineText 参数 lineText。
 * @param position 参数 position。
 * @returns 返回 vscode.Range 类型结果。
 * 返回值示例：const result = getCurrentWordRange('demo-value', position); // { ok: true }
 */
function getCurrentWordRange(lineText: string, position: vscode.Position): vscode.Range {
    // 变量：start，用于存储start。
    let start = position.character;
    while (start > 0 && !isWhitespace(lineText[start - 1])) {
        start--;
    }
    return new vscode.Range(position.line, start, position.line, position.character);
}

/**
 * 方法：isWhitespace
 * 说明：执行 isWhitespace 相关处理逻辑。
 * @param char 参数 char。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = isWhitespace('demo-value'); // true
 */
function isWhitespace(char: string): boolean {
    return char === ' ' || char === '\t';
}
