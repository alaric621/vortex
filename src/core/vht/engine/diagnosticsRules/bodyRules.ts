import { AST } from '../parser/types';
import { DiagnosticIssue } from './types';

/**
 * 方法：collectBodyIssues
 * 说明：执行 collectBodyIssues 相关处理逻辑。
 * @param ast 参数 ast。
 * @returns 返回 VhtDiagnosticIssue[] 列表。
 * 返回值示例：const list = collectBodyIssues(ast); // [{ id: 'demo' }]
 */
export function collectBodyIssues(ast: AST): DiagnosticIssue[] {
    // 变量：issues，用于存储issues。
    const issues: DiagnosticIssue[] = [];
    // 变量：body，用于存储正文。
    const body = ast.sections.body;

    if (!body) {
        return issues;
    }

    if (!ast.sections.request) {
        issues.push({
            range: body.range,
            message: '存在 Body 但缺少 RequestLine。',
            code: 'body-without-request',
            severity: 'error',
            source: 'VHT Rules'
        });
    }

    if (body.raw.trim().length === 0) {
        issues.push({
            range: body.range,
            message: 'Body 为空内容。',
            code: 'empty-body',
            severity: 'info',
            source: 'VHT Rules'
        });
    }

    return issues;
}
