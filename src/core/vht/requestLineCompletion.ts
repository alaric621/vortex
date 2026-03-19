import * as vscode from 'vscode';
import { ASTNode, VhtAST } from './types';

const REQUEST_METHODS = [
    'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'CONNECT', 'TRACE',
    'WEBSOCKET', 'SSE', 'EVENTSOURCE', 'SUBSCRIBE', 'UNSUBSCRIBE'
];

const PROTOCOL_SCHEMES = ['http://', 'https://', 'ws://', 'wss://'];
const HTTP_VERSIONS = ['HTTP/1.0', 'HTTP/1.1', 'HTTP/2', 'HTTP/3'];

export function isInRequestLine(
    document: vscode.TextDocument,
    ast: VhtAST,
    position: vscode.Position,
    nodeAtCursor?: ASTNode
): boolean {
    if (nodeAtCursor?.type === 'RequestLine') {
        return true;
    }

    const requestNode = ast.sections.request;
    if (requestNode) {
        return position.line === requestNode.range.start.line;
    }

    return position.line === 0 && document.lineAt(0).text.trim() !== '';
}

export function getRequestLineCompletions(
    document: vscode.TextDocument,
    position: vscode.Position,
    ast: VhtAST
): vscode.CompletionItem[] {
    const lineText = document.lineAt(position.line).text;
    const linePrefix = lineText.slice(0, position.character);
    const tokenInfo = getTokenInfo(linePrefix);
    const currentWordRange = getCurrentWordRange(lineText, position);

    const requestData = ast.sections.request?.data ?? {};
    const hasUrlInAst = typeof requestData.url === 'string' && requestData.url.length > 0;

    if (tokenInfo.tokens.length === 0) {
        return createMethodCompletions(currentWordRange);
    }

    if (tokenInfo.tokens.length === 1) {
        if (tokenInfo.cursorInWhitespace) {
            return createSchemeCompletions(currentWordRange);
        }
        return createMethodCompletions(currentWordRange);
    }

    if (tokenInfo.tokens.length === 2) {
        if (tokenInfo.cursorInWhitespace && (hasUrlInAst || tokenInfo.tokens[1].length > 0)) {
            return createVersionCompletions(currentWordRange);
        }
        return createSchemeCompletions(currentWordRange);
    }

    if (tokenInfo.tokens.length >= 3) {
        return createVersionCompletions(currentWordRange);
    }

    return [];
}

function createMethodCompletions(range: vscode.Range): vscode.CompletionItem[] {
    return REQUEST_METHODS.map(method => {
        const item = new vscode.CompletionItem(method, vscode.CompletionItemKind.Keyword);
        item.insertText = new vscode.SnippetString(`${method} \${1:http://localhost}`);
        item.detail = 'HTTP Method';
        item.range = range;
        return item;
    });
}

function createSchemeCompletions(range: vscode.Range): vscode.CompletionItem[] {
    return PROTOCOL_SCHEMES.map(scheme => {
        const item = new vscode.CompletionItem(scheme, vscode.CompletionItemKind.Value);
        item.insertText = scheme;
        item.detail = 'URL Scheme';
        item.range = range;
        return item;
    });
}

function createVersionCompletions(range: vscode.Range): vscode.CompletionItem[] {
    return HTTP_VERSIONS.map(version => {
        const item = new vscode.CompletionItem(version, vscode.CompletionItemKind.EnumMember);
        item.insertText = version;
        item.detail = 'HTTP Version';
        item.range = range;
        return item;
    });
}

function getTokenInfo(linePrefix: string): { tokens: string[]; cursorInWhitespace: boolean } {
    const tokens: string[] = [];
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

function getCurrentWordRange(lineText: string, position: vscode.Position): vscode.Range {
    let start = position.character;
    while (start > 0 && !isWhitespace(lineText[start - 1])) {
        start--;
    }
    return new vscode.Range(position.line, start, position.line, position.character);
}

function isWhitespace(char: string): boolean {
    return char === ' ' || char === '\t';
}
