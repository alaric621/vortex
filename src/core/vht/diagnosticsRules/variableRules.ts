import { getVhtVariables } from '../../../env';
import { VhtAST } from '../types';
import { VhtDiagnosticIssue } from './types';
import { resolveVariableExpression } from '../variableExpression';

const VARIABLE_OPEN = '{{';
const VARIABLE_CLOSE = '}}';

export function collectVariableIssues(ast: VhtAST, text: string, variables: Record<string, unknown> = getVhtVariables()): VhtDiagnosticIssue[] {
    const issues: VhtDiagnosticIssue[] = [];
    issues.push(...collectBraceIssues(text));

    for (const variable of ast.variables) {
        const expression = variable.expression.trim();
        if (!expression) {
            issues.push({
                range: variable.range,
                message: '变量表达式不能为空。',
                code: 'empty-variable-expression',
                severity: 'error',
                source: 'VHT Variable Rules'
            });
            continue;
        }

        const status = validateVariableExpression(expression, variables);
        if (status.kind === 'ok') continue;

        if (status.kind === 'syntax-error') {
            issues.push({
                range: variable.range,
                message: `变量表达式语法错误: ${status.message}`,
                code: 'invalid-variable-expression',
                severity: 'error',
                source: 'VHT Variable Rules'
            });
            continue;
        }

        if (status.kind === 'invalid-type-access') {
            issues.push({
                range: variable.range,
                message: `变量访问类型错误: ${status.message}`,
                code: 'invalid-variable-type-access',
                severity: 'error',
                source: 'VHT Variable Rules'
            });
            continue;
        }

        issues.push({
            range: variable.range,
            message: `未找到变量: ${status.path}`,
            code: 'unknown-variable-path',
            severity: 'warning',
            source: 'VHT Variable Rules'
        });
    }

    return issues;
}

function collectBraceIssues(text: string): VhtDiagnosticIssue[] {
    const issues: VhtDiagnosticIssue[] = [];
    let index = 0;
    let openStack: number[] = [];

    while (index < text.length) {
        if (text.startsWith(VARIABLE_OPEN, index)) {
            openStack.push(index);
            index += VARIABLE_OPEN.length;
            continue;
        }
        if (text.startsWith(VARIABLE_CLOSE, index)) {
            const open = openStack.pop();
            if (open === undefined) {
                const pos = offsetToPosition(text, index);
                issues.push({
                    range: {
                        start: pos,
                        end: { line: pos.line, character: pos.character + 2 }
                    },
                    message: '孤立的变量结束标记 "}}"。',
                    code: 'orphan-variable-close',
                    severity: 'error',
                    source: 'VHT Variable Rules'
                });
            }
            index += VARIABLE_CLOSE.length;
            continue;
        }
        index++;
    }

    for (const open of openStack) {
        const pos = offsetToPosition(text, open);
        issues.push({
            range: {
                start: pos,
                end: { line: pos.line, character: pos.character + 2 }
            },
            message: '未闭合的变量开始标记 "{{"。',
            code: 'unclosed-variable-open',
            severity: 'error',
            source: 'VHT Variable Rules'
        });
    }

    return issues;
}

type ValidationResult =
    | { kind: 'ok' }
    | { kind: 'syntax-error'; message: string }
    | { kind: 'invalid-type-access'; message: string }
    | { kind: 'unknown-path'; path: string };

function validateVariableExpression(expression: string, vars: Record<string, unknown>): ValidationResult {
    const resolved = resolveVariableExpression(expression, vars);
    if (resolved.kind === "resolved") {
        return { kind: "ok" };
    }
    if (resolved.kind === "syntax-error") {
        return { kind: "syntax-error", message: resolved.message };
    }
    if (resolved.kind === "invalid-type-access") {
        return { kind: "invalid-type-access", message: resolved.message };
    }
    return { kind: "unknown-path", path: resolved.path };
}

function offsetToPosition(text: string, offset: number): { line: number; character: number } {
    const head = text.slice(0, offset);
    const lines = head.split('\n');
    return {
        line: lines.length - 1,
        character: lines[lines.length - 1]?.length ?? 0
    };
}
