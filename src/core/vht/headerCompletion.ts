import * as vscode from 'vscode';
import { ASTNode, VhtAST } from './types';

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

const SSE_HEADER_KEYS = [
    'Accept',
    'Cache-Control',
    'Connection',
    'Last-Event-ID'
];

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

export function isInHeaderSection(
    document: vscode.TextDocument,
    ast: VhtAST,
    position: vscode.Position,
    nodeAtCursor?: ASTNode
): boolean {
    if (nodeAtCursor?.type === 'Header') {
        return true;
    }

    const requestNode = ast.sections.request;
    if (!requestNode) {
        return false;
    }

    if (position.line <= requestNode.range.start.line) {
        return false;
    }

    const currentText = document.lineAt(position.line).text.trim();
    if (currentText === '') {
        return false;
    }

    const bodyStart = ast.sections.body?.range.start.line;
    if (typeof bodyStart === 'number' && position.line >= bodyStart) {
        return false;
    }

    const preScriptStart = ast.sections.scripts.pre?.range.start.line;
    if (typeof preScriptStart === 'number' && position.line >= preScriptStart) {
        return false;
    }

    const postScriptStart = ast.sections.scripts.post?.range.start.line;
    if (typeof postScriptStart === 'number' && position.line >= postScriptStart) {
        return false;
    }

    for (let line = requestNode.range.start.line + 1; line < position.line; line++) {
        const text = document.lineAt(line).text.trim();
        if (text === '') {
            return false;
        }
    }

    return true;
}

export function getHeaderCompletions(
    document: vscode.TextDocument,
    position: vscode.Position,
    ast: VhtAST
): vscode.CompletionItem[] {
    const lineText = document.lineAt(position.line).text;
    const colonIndex = lineText.indexOf(':');
    const isValueContext = colonIndex >= 0 && position.character > colonIndex;

    if (isValueContext) {
        return getHeaderValueCompletions(document, position, lineText, colonIndex);
    }

    return getHeaderKeyCompletions(document, position, ast, lineText);
}

function getHeaderKeyCompletions(
    document: vscode.TextDocument,
    position: vscode.Position,
    ast: VhtAST,
    lineText: string
): vscode.CompletionItem[] {
    const protocol = detectProtocol(ast);
    const protocolKeys = getHeaderKeysByProtocol(protocol);
    const existing = new Set(
        ast.sections.headers
            .filter(node => node.type === 'Header')
            .map(node => String(node.data?.key ?? '').toLowerCase())
            .filter(Boolean)
    );

    const editingKey = lineText.split(':', 1)[0].trim().toLowerCase();
    if (editingKey) {
        existing.delete(editingKey);
    }

    const range = getHeaderKeyRange(document, position);

    return protocolKeys
        .filter(key => !existing.has(key.toLowerCase()))
        .map(key => {
            const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Field);
            item.insertText = new vscode.SnippetString(`${key}: \${1}`);
            item.detail = `Header Key (${protocol.toUpperCase()})`;
            item.range = range;
            return item;
        });
}

function getHeaderValueCompletions(
    document: vscode.TextDocument,
    position: vscode.Position,
    lineText: string,
    colonIndex: number
): vscode.CompletionItem[] {
    const rawKey = lineText.slice(0, colonIndex).trim().toLowerCase();
    const values = HEADER_VALUE_SUGGESTIONS[rawKey] ?? ['${1:value}'];
    const range = getHeaderValueRange(document, position, colonIndex);

    return values.map(value => {
        const item = new vscode.CompletionItem(value, vscode.CompletionItemKind.Value);
        item.insertText = new vscode.SnippetString(value);
        item.detail = rawKey ? `Header Value (${rawKey})` : 'Header Value';
        item.range = range;
        return item;
    });
}

function detectProtocol(ast: VhtAST): 'http' | 'websocket' | 'sse' {
    const method = String(ast.sections.request?.data?.method ?? '').toUpperCase();
    const url = String(ast.sections.request?.data?.url ?? '').toLowerCase();

    if (method === 'WEBSOCKET' || startsWith(url, 'ws://') || startsWith(url, 'wss://')) {
        return 'websocket';
    }

    if (method === 'SSE' || method === 'EVENTSOURCE' || method === 'SUBSCRIBE') {
        return 'sse';
    }

    return 'http';
}

function getHeaderKeysByProtocol(protocol: 'http' | 'websocket' | 'sse'): string[] {
    if (protocol === 'websocket') {
        return dedupeKeys([...COMMON_HEADER_KEYS, ...WEBSOCKET_HEADER_KEYS]);
    }

    if (protocol === 'sse') {
        return dedupeKeys([...COMMON_HEADER_KEYS, ...SSE_HEADER_KEYS]);
    }

    return dedupeKeys([...COMMON_HEADER_KEYS, ...HTTP_HEADER_KEYS]);
}

function dedupeKeys(keys: string[]): string[] {
    const seen = new Set<string>();
    const output: string[] = [];
    for (const key of keys) {
        const normalized = key.toLowerCase();
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        output.push(key);
    }
    return output;
}

function startsWith(source: string, prefix: string): boolean {
    return source.slice(0, prefix.length) === prefix;
}

function getHeaderKeyRange(document: vscode.TextDocument, position: vscode.Position): vscode.Range {
    const lineText = document.lineAt(position.line).text;
    const colonIndex = lineText.indexOf(':');
    const end = colonIndex >= 0 ? Math.min(position.character, colonIndex) : position.character;

    let start = end;
    while (start > 0 && /[\w-]/.test(lineText[start - 1])) {
        start--;
    }

    return new vscode.Range(position.line, start, position.line, end);
}

function getHeaderValueRange(document: vscode.TextDocument, position: vscode.Position, colonIndex: number): vscode.Range {
    const lineText = document.lineAt(position.line).text;
    let start = colonIndex + 1;
    while (start < lineText.length && /\s/.test(lineText[start])) {
        start++;
    }

    return new vscode.Range(position.line, start, position.line, position.character);
}
