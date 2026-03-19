import { VhtAST } from '../types';
import { VhtDiagnosticIssue } from './types';

export function collectBodyIssues(ast: VhtAST): VhtDiagnosticIssue[] {
    const issues: VhtDiagnosticIssue[] = [];
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
