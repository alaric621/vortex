import * as vscode from 'vscode';
import { ASTNode, VhtAST } from './types';

// 变量：COMMON_HEADER_KEYS，用于存储commonheaderkeys。
const COMMON_HEADER_KEYS = [
    'Authorization',
    'Cache-Control',
    'Connection',
    'Content-Length',
    'Content-Type',
    'Cookie',
    'Date',
    'Host',
    'Origin',
    'Pragma',
    'Referer',
    'User-Agent',
    'X-API-Key',
    'X-CSRF-Token',
    'X-Forwarded-For',
    'X-Forwarded-Host',
    'X-Forwarded-Proto',
    'X-HTTP-Method-Override',
    'X-Requested-With',
    'X-Trace-Id'
];

// 变量：HTTP_HEADER_KEYS，用于存储httpheaderkeys。
const HTTP_HEADER_KEYS = [
    'Accept',
    'Accept-CH',
    'Accept-Charset',
    'Accept-Encoding',
    'Accept-Language',
    'Accept-Patch',
    'Accept-Post',
    'Access-Control-Request-Headers',
    'Access-Control-Request-Method',
    'Content-Digest',
    'Device-Memory',
    'DNT',
    'Downlink',
    'ECT',
    'Expect',
    'Forwarded',
    'From',
    'If-Match',
    'If-Modified-Since',
    'If-None-Match',
    'If-Range',
    'If-Unmodified-Since',
    'Keep-Alive',
    'Max-Forwards',
    'Priority',
    'Proxy-Authorization',
    'Range',
    'RTT',
    'Save-Data',
    'Sec-CH-UA',
    'Sec-CH-UA-Mobile',
    'Sec-CH-UA-Platform',
    'Sec-Fetch-Dest',
    'Sec-Fetch-Mode',
    'Sec-Fetch-Site',
    'Sec-Fetch-User',
    'TE',
    'Trailer',
    'Transfer-Encoding',
    'Upgrade-Insecure-Requests',
    'Via',
    'Viewport-Width',
    'Want-Content-Digest',
    'Want-Digest',
    'Warning',
    'Width'
];

// 变量：WEBSOCKET_HEADER_KEYS，用于存储WebSocketheaderkeys。
const WEBSOCKET_HEADER_KEYS = [
    'Upgrade',
    'Connection',
    'Sec-WebSocket-Key',
    'Sec-WebSocket-Version',
    'Sec-WebSocket-Protocol',
    'Sec-WebSocket-Extensions',
    'Origin',
    'Pragma',
    'Cache-Control'
];

// 变量：SSE_HEADER_KEYS，用于存储SSEheaderkeys。
const SSE_HEADER_KEYS = [
    'Accept',
    'Cache-Control',
    'Connection',
    'Last-Event-ID'
];

// 变量：HEADER_VALUE_SUGGESTIONS，用于存储headervaluesuggestions。
const HEADER_VALUE_SUGGESTIONS: Record<string, string[]> = {
    'accept': ['application/json', '*/*', 'text/plain', 'application/xml'],
    'accept-encoding': ['gzip, deflate, br', 'gzip', 'identity'],
    'accept-language': ['en-US,en;q=0.9', 'zh-CN,zh;q=0.9'],
    'authorization': ['Bearer ${1:token}', 'Basic ${1:base64(username:password)}'],
    'cache-control': ['no-cache', 'no-store', 'max-age=0', 'public, max-age=3600'],
    'connection': ['keep-alive', 'close'],
    'content-type': ['application/json', 'application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain'],
    'content-length': ['${1:0}'],
    'cookie': ['${1:name}=${2:value}'],
    'host': ['localhost', 'localhost:3000'],
    'last-event-id': ['${1:event-id}'],
    'origin': ['http://localhost:3000', 'https://localhost:3000'],
    'referer': ['http://localhost:3000/'],
    'sec-websocket-extensions': ['permessage-deflate; client_max_window_bits'],
    'sec-websocket-key': ['${1:dGhlIHNhbXBsZSBub25jZQ==}'],
    'sec-websocket-protocol': ['json', 'graphql-ws'],
    'sec-websocket-version': ['13'],
    'upgrade': ['websocket'],
    'user-agent': ['Mozilla/5.0', 'vortex-client/1.0'],
    'x-api-key': ['${1:api_key}'],
    'x-csrf-token': ['${1:csrf_token}']
};

/**
 * 方法：isInHeaderSection
 * 说明：执行 isInHeaderSection 相关处理逻辑。
 * @param document 参数 document。
 * @param ast 参数 ast。
 * @param position 参数 position。
 * @param nodeAtCursor 参数 nodeAtCursor。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = isInHeaderSection(document, ast, position, { ... }); // true
 */
export function isInHeaderSection(
    document: vscode.TextDocument,
    ast: VhtAST,
    position: vscode.Position,
    nodeAtCursor?: ASTNode
): boolean {
    if (nodeAtCursor?.type === 'Header') return true;

    // 变量：requestNode，用于存储请求节点。
    const requestNode = ast.sections.request;
    if (!requestNode) return false;
    if (position.line <= requestNode.range.start.line) return false;
    if (document.lineAt(position.line).text.trim() === '') return false;
    if (isAfterNonHeaderSection(ast, position.line)) return false;

    return hasContinuousHeaderLines(document, requestNode.range.start.line + 1, position.line);
}

/**
 * 方法：getHeaderCompletions
 * 说明：执行 getHeaderCompletions 相关处理逻辑。
 * @param document 参数 document。
 * @param position 参数 position。
 * @param ast 参数 ast。
 * @returns 返回 vscode.CompletionItem[] 列表。
 * 返回值示例：const list = getHeaderCompletions(document, position, ast); // [{ id: 'demo' }]
 */
export function getHeaderCompletions(
    document: vscode.TextDocument,
    position: vscode.Position,
    ast: VhtAST
): vscode.CompletionItem[] {
    // 变量：lineText，用于存储行text。
    const lineText = document.lineAt(position.line).text;
    // 变量：colonIndex，用于存储colonindex。
    const colonIndex = lineText.indexOf(':');
    // 变量：isValueContext，用于存储isvaluecontext。
    const isValueContext = colonIndex >= 0 && position.character > colonIndex;

    if (isValueContext) {
        return getHeaderValueCompletions(document, position, lineText, colonIndex);
    }

    return getHeaderKeyCompletions(document, position, ast, lineText);
}

/**
 * 方法：getHeaderKeyCompletions
 * 说明：执行 getHeaderKeyCompletions 相关处理逻辑。
 * @param document 参数 document。
 * @param position 参数 position。
 * @param ast 参数 ast。
 * @param lineText 参数 lineText。
 * @returns 返回 vscode.CompletionItem[] 列表。
 * 返回值示例：const list = getHeaderKeyCompletions(document, position, ast, 'demo-value'); // [{ id: 'demo' }]
 */
function getHeaderKeyCompletions(
    document: vscode.TextDocument,
    position: vscode.Position,
    ast: VhtAST,
    lineText: string
): vscode.CompletionItem[] {
    // 变量：protocol，用于存储protocol。
    const protocol = detectProtocol(ast);
    // 变量：existing，用于存储existing。
    const existing = getExistingHeaderKeys(ast, lineText);

    // 变量：range，用于存储范围。
    const range = getHeaderKeyRange(document, position);

    return getHeaderKeysByProtocol(protocol)
        .filter(key => !existing.has(key.toLowerCase()))
        .map(key => {
            // 变量：item，用于存储item。
            const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Field);
            item.insertText = new vscode.SnippetString(`${key}: \${1}`);
            item.detail = `Header Key (${protocol.toUpperCase()})`;
            item.range = range;
            return item;
        });
}

/**
 * 方法：getHeaderValueCompletions
 * 说明：执行 getHeaderValueCompletions 相关处理逻辑。
 * @param document 参数 document。
 * @param position 参数 position。
 * @param lineText 参数 lineText。
 * @param colonIndex 参数 colonIndex。
 * @returns 返回 vscode.CompletionItem[] 列表。
 * 返回值示例：const list = getHeaderValueCompletions(document, position, 'demo-value', 1); // [{ id: 'demo' }]
 */
function getHeaderValueCompletions(
    document: vscode.TextDocument,
    position: vscode.Position,
    lineText: string,
    colonIndex: number
): vscode.CompletionItem[] {
    // 变量：rawKey，用于存储rawkey。
    const rawKey = lineText.slice(0, colonIndex).trim().toLowerCase();
    // 变量：values，用于存储values。
    const values = HEADER_VALUE_SUGGESTIONS[rawKey] ?? ['${1:value}'];
    // 变量：range，用于存储范围。
    const range = getHeaderValueRange(document, position, colonIndex);

    return values.map(value => {
        // 变量：item，用于存储item。
        const item = new vscode.CompletionItem(value, vscode.CompletionItemKind.Value);
        item.insertText = new vscode.SnippetString(value);
        item.detail = rawKey ? `Header Value (${rawKey})` : 'Header Value';
        item.range = range;
        return item;
    });
}

/**
 * 方法：detectProtocol
 * 说明：执行 detectProtocol 相关处理逻辑。
 * @param ast 参数 ast。
 * @returns 返回 'http' | 'websocket' | 'sse' 类型结果。
 * 返回值示例：const result = detectProtocol(ast); // { ok: true }
 */
function detectProtocol(ast: VhtAST): 'http' | 'websocket' | 'sse' {
    // 变量：method，用于存储方法。
    const method = String(ast.sections.request?.data?.method ?? '').toUpperCase();
    // 变量：url，用于存储地址。
    const url = String(ast.sections.request?.data?.url ?? '').toLowerCase();

    if (isWebSocketProtocol(method, url)) {
        return 'websocket';
    }

    if (isSseProtocol(method)) {
        return 'sse';
    }

    return 'http';
}

/**
 * 方法：getHeaderKeysByProtocol
 * 说明：执行 getHeaderKeysByProtocol 相关处理逻辑。
 * @param protocol 参数 protocol。
 * @returns 返回 string[] 列表。
 * 返回值示例：const list = getHeaderKeysByProtocol('http'); // [{ id: 'demo' }]
 */
function getHeaderKeysByProtocol(protocol: 'http' | 'websocket' | 'sse'): string[] {
    if (protocol === 'websocket') {
        return dedupeKeys([...COMMON_HEADER_KEYS, ...WEBSOCKET_HEADER_KEYS]);
    }

    if (protocol === 'sse') {
        return dedupeKeys([...COMMON_HEADER_KEYS, ...SSE_HEADER_KEYS]);
    }

    return dedupeKeys([...COMMON_HEADER_KEYS, ...HTTP_HEADER_KEYS]);
}

/**
 * 方法：dedupeKeys
 * 说明：执行 dedupeKeys 相关处理逻辑。
 * @param keys 参数 keys。
 * @returns 返回 string[] 列表。
 * 返回值示例：const list = dedupeKeys([]); // [{ id: 'demo' }]
 */
function dedupeKeys(keys: string[]): string[] {
    // 变量：seen，用于存储seen。
    const seen = new Set<string>();
    // 变量：output，用于存储输出。
    const output: string[] = [];
    for (const key of keys) {
        // 变量：normalized，用于存储normalized。
        const normalized = key.toLowerCase();
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        output.push(key);
    }
    return output;
}

/**
 * 方法：getExistingHeaderKeys
 * 说明：执行 getExistingHeaderKeys 相关处理逻辑。
 * @param ast 参数 ast。
 * @param lineText 参数 lineText。
 * @returns 返回 Set<string> 类型结果。
 * 返回值示例：const result = getExistingHeaderKeys(ast, 'demo-value'); // { ok: true }
 */
function getExistingHeaderKeys(ast: VhtAST, lineText: string): Set<string> {
    // 变量：keys，用于存储keys。
    const keys = new Set(
        ast.sections.headers
            .filter(node => node.type === 'Header')
            .map(node => String(node.data?.key ?? '').toLowerCase())
            .filter(Boolean)
    );

    // 变量：editingKey，用于存储editingkey。
    const editingKey = lineText.split(':', 1)[0].trim().toLowerCase();
    if (editingKey) {
        keys.delete(editingKey);
    }

    return keys;
}

/**
 * 方法：isAfterNonHeaderSection
 * 说明：执行 isAfterNonHeaderSection 相关处理逻辑。
 * @param ast 参数 ast。
 * @param line 参数 line。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = isAfterNonHeaderSection(ast, 1); // true
 */
function isAfterNonHeaderSection(ast: VhtAST, line: number): boolean {
    return getSectionStartLines(ast).some(start => typeof start === 'number' && line >= start);
}

/**
 * 方法：getSectionStartLines
 * 说明：执行 getSectionStartLines 相关处理逻辑。
 * @param ast 参数 ast。
 * @returns 命中时返回 Array<number >，未命中时返回 undefined。
 * 返回值示例：const list = getSectionStartLines(ast); // { ok: true }
 */
function getSectionStartLines(ast: VhtAST): Array<number | undefined> {
    return [
        ast.sections.body?.range.start.line,
        ast.sections.scripts.pre?.range.start.line,
        ast.sections.scripts.post?.range.start.line
    ];
}

/**
 * 方法：hasContinuousHeaderLines
 * 说明：执行 hasContinuousHeaderLines 相关处理逻辑。
 * @param document 参数 document。
 * @param startLine 参数 startLine。
 * @param endLine 参数 endLine。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = hasContinuousHeaderLines(document, 1, 1); // true
 */
function hasContinuousHeaderLines(document: vscode.TextDocument, startLine: number, endLine: number): boolean {
    for (let line = startLine; line < endLine; line++) {
        if (document.lineAt(line).text.trim() === '') {
            return false;
        }
    }

    return true;
}

/**
 * 方法：isWebSocketProtocol
 * 说明：执行 isWebSocketProtocol 相关处理逻辑。
 * @param method 参数 method。
 * @param url 参数 url。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = isWebSocketProtocol('demo-value', 'demo-value'); // true
 */
function isWebSocketProtocol(method: string, url: string): boolean {
    return method === 'WEBSOCKET' || url.startsWith('ws://') || url.startsWith('wss://');
}

/**
 * 方法：isSseProtocol
 * 说明：执行 isSseProtocol 相关处理逻辑。
 * @param method 参数 method。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = isSseProtocol('demo-value'); // true
 */
function isSseProtocol(method: string): boolean {
    return method === 'SSE' || method === 'EVENTSOURCE' || method === 'SUBSCRIBE';
}

/**
 * 方法：getHeaderKeyRange
 * 说明：执行 getHeaderKeyRange 相关处理逻辑。
 * @param document 参数 document。
 * @param position 参数 position。
 * @returns 返回 vscode.Range 类型结果。
 * 返回值示例：const result = getHeaderKeyRange(document, position); // { ok: true }
 */
function getHeaderKeyRange(document: vscode.TextDocument, position: vscode.Position): vscode.Range {
    // 变量：lineText，用于存储行text。
    const lineText = document.lineAt(position.line).text;
    // 变量：colonIndex，用于存储colonindex。
    const colonIndex = lineText.indexOf(':');
    // 变量：end，用于存储end。
    const end = colonIndex >= 0 ? Math.min(position.character, colonIndex) : position.character;

    // 变量：start，用于存储start。
    let start = end;
    while (start > 0 && /[\w-]/.test(lineText[start - 1])) {
        start--;
    }

    return new vscode.Range(position.line, start, position.line, end);
}

/**
 * 方法：getHeaderValueRange
 * 说明：执行 getHeaderValueRange 相关处理逻辑。
 * @param document 参数 document。
 * @param position 参数 position。
 * @param colonIndex 参数 colonIndex。
 * @returns 返回 vscode.Range 类型结果。
 * 返回值示例：const result = getHeaderValueRange(document, position, 1); // { ok: true }
 */
function getHeaderValueRange(document: vscode.TextDocument, position: vscode.Position, colonIndex: number): vscode.Range {
    // 变量：lineText，用于存储行text。
    const lineText = document.lineAt(position.line).text;
    // 变量：start，用于存储start。
    let start = colonIndex + 1;
    while (start < lineText.length && /\s/.test(lineText[start])) {
        start++;
    }

    return new vscode.Range(position.line, start, position.line, position.character);
}
