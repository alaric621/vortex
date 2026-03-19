import { vhtMockVariables } from '../../../env';
import { VhtAST } from '../types';
import { VhtDiagnosticIssue } from './types';

const VARIABLE_OPEN = '{{';
const VARIABLE_CLOSE = '}}';

export function collectVariableIssues(ast: VhtAST, text: string): VhtDiagnosticIssue[] {
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

        const status = checkVariablePathExists(expression, vhtMockVariables);
        if (!status) {
            issues.push({
                range: variable.range,
                message: `未找到变量: ${expression}`,
                code: 'unknown-variable-path',
                severity: 'warning',
                source: 'VHT Variable Rules'
            });
        }
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

function checkVariablePathExists(expression: string, vars: Record<string, unknown>): boolean {
    const tokens = tokenizeExpression(expression);
    if (tokens.length === 0) return false;

    let current: unknown = vars;
    for (const token of tokens) {
        if (!isObjectLike(current) || !(token in current)) {
            return false;
        }
        current = (current as Record<string, unknown>)[token];
    }
    return true;
}

function tokenizeExpression(expression: string): string[] {
    const direct = expression.match(/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[['"][^'"]+['"]\])*$/);
    if (!direct) return [];

    const rootMatch = expression.match(/^[A-Za-z_$][\w$]*/);
    const tokens: string[] = [];
    if (!rootMatch) return tokens;
    tokens.push(rootMatch[0]);

    const tail = expression.slice(rootMatch[0].length);
    const matcher = /(?:\.([A-Za-z_$][\w$]*)|\[['"]([^'"]+)['"]\])/g;
    for (const match of tail.matchAll(matcher)) {
        const token = match[1] ?? match[2];
        if (token) tokens.push(token);
    }
    return tokens;
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object';
}

function offsetToPosition(text: string, offset: number): { line: number; character: number } {
    const head = text.slice(0, offset);
    const lines = head.split('\n');
    return {
        line: lines.length - 1,
        character: lines[lines.length - 1]?.length ?? 0
    };
}
