import { VhtAST } from '../types';
import { VhtDiagnosticIssue } from './types';

const ALLOWED_METHODS = new Set([
    'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'CONNECT', 'TRACE',
    'WEBSOCKET', 'SSE', 'EVENTSOURCE', 'SUBSCRIBE', 'UNSUBSCRIBE'
]);

export function collectRequestIssues(ast: VhtAST, text: string): VhtDiagnosticIssue[] {
    const issues: VhtDiagnosticIssue[] = [];
    const requestNode = ast.sections.request;

    const hasNonEmptyText = text.split(/\r?\n/).some(line => line.trim() !== '');
    const hasNonScriptNode = ast.nodes.some(node => node.type !== 'PreScript' && node.type !== 'PostScript');

    if (!requestNode) {
        if (hasNonEmptyText && hasNonScriptNode) {
            issues.push({
                range: ast.nodes[0]?.range ?? {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 0 }
                },
                message: '缺少 RequestLine，请以 METHOD URL 开头。',
                code: 'missing-request-line',
                severity: 'error',
                source: 'VHT Rules'
            });
        }
        return issues;
    }

    const method = String(requestNode.data?.method ?? '').toUpperCase();
    const url = String(requestNode.data?.url ?? '').trim();
    const version = String(requestNode.data?.version ?? '').trim();

    if (!method || !ALLOWED_METHODS.has(method)) {
        issues.push({
            range: requestNode.range,
            message: `无效的请求方法: "${method || '(empty)'}"。`,
            code: 'invalid-request-method',
            severity: 'error',
            source: 'VHT Rules'
        });
    }

    if (!url) {
        issues.push({
            range: requestNode.range,
            message: 'RequestLine 缺少 URL。',
            code: 'missing-request-url',
            severity: 'warning',
            source: 'VHT Rules'
        });
    }

    if (version && !/^HTTP\/\d+(?:\.\d+)?$/i.test(version)) {
        issues.push({
            range: requestNode.range,
            message: `无效的 HTTP 版本: "${version}"。`,
            code: 'invalid-request-version',
            severity: 'error',
            source: 'VHT Rules'
        });
    }

    return issues;
}
