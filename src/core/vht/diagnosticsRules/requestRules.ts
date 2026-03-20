import { ASTNode, VhtAST } from '../parser/types';
import { VhtDiagnosticIssue } from './types';

// 变量：ALLOWED_METHODS，用于存储allowedmethods。
const ALLOWED_METHODS = new Set([
    'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'CONNECT', 'TRACE',
    'WEBSOCKET', 'SSE', 'EVENTSOURCE', 'SUBSCRIBE', 'UNSUBSCRIBE'
]);

/**
 * 方法：collectRequestIssues
 * 说明：执行 collectRequestIssues 相关处理逻辑。
 * @param ast 参数 ast。
 * @param text 参数 text。
 * @returns 返回 VhtDiagnosticIssue[] 列表。
 * 返回值示例：const list = collectRequestIssues(ast, 'demo-value'); // [{ id: 'demo' }]
 */
export function collectRequestIssues(ast: VhtAST, text: string): VhtDiagnosticIssue[] {
    // 变量：issues，用于存储issues。
    const issues: VhtDiagnosticIssue[] = [];
    // 变量：requestNode，用于存储请求节点。
    const requestNode = ast.sections.request;

    // 变量：hasNonEmptyText，用于存储hasnonemptytext。
    const hasNonEmptyText = text.split(/\r?\n/).some(line => line.trim() !== '');
    // 变量：hasNonScriptNode，用于存储hasnonscript节点。
    const hasNonScriptNode = ast.nodes.some((node: ASTNode) => node.type !== 'PreScript' && node.type !== 'PostScript');

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

    // 变量：method，用于存储方法。
    const method = String(requestNode.data?.method ?? '').toUpperCase();
    // 变量：url，用于存储地址。
    const url = String(requestNode.data?.url ?? '').trim();
    // 变量：version，用于存储version。
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
