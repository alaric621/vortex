import { AST } from '../parser/types';
import { DiagnosticIssue } from './types';
import { resolveVariableExpression } from '../variableExpression';

// 变量：VARIABLE_OPEN，用于存储变量open。
const VARIABLE_OPEN = '{{';
// 变量：VARIABLE_CLOSE，用于存储变量close。
const VARIABLE_CLOSE = '}}';

/**
 * 方法：collectVariableIssues
 * 说明：执行 collectVariableIssues 相关处理逻辑。
 * @param ast 参数 ast。
 * @param text 参数 text。
 * @param variables 参数 variables。
 * @returns 返回 VhtDiagnosticIssue[] 列表。
 * 返回值示例：const list = collectVariableIssues(ast, 'demo-value', { token: 'abc' }); // [{ id: 'demo' }]
 */
export function collectVariableIssues(
  ast: AST,
  text: string,
  variables: Record<string, unknown> = {}
): DiagnosticIssue[] {
    // 变量：issues，用于存储issues。
    const issues: DiagnosticIssue[] = [];
    issues.push(...collectBraceIssues(text));

    for (const variable of ast.variables) {
        // 变量：expression，用于存储表达式。
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

        // 变量：status，用于存储status。
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

/**
 * 方法：collectBraceIssues
 * 说明：执行 collectBraceIssues 相关处理逻辑。
 * @param text 参数 text。
 * @returns 返回 VhtDiagnosticIssue[] 列表。
 * 返回值示例：const list = collectBraceIssues('demo-value'); // [{ id: 'demo' }]
 */
function collectBraceIssues(text: string): DiagnosticIssue[] {
    // 变量：issues，用于存储issues。
    const issues: DiagnosticIssue[] = [];
    // 变量：index，用于存储index。
    let index = 0;
    // 变量：openStack，用于存储openstack。
    let openStack: number[] = [];

    while (index < text.length) {
        if (text.startsWith(VARIABLE_OPEN, index)) {
            openStack.push(index);
            index += VARIABLE_OPEN.length;
            continue;
        }
        if (text.startsWith(VARIABLE_CLOSE, index)) {
            // 变量：open，用于存储open。
            const open = openStack.pop();
            if (open === undefined) {
                // 变量：pos，用于存储pos。
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
        // 变量：pos，用于存储pos。
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

/**
 * 方法：validateVariableExpression
 * 说明：执行 validateVariableExpression 相关处理逻辑。
 * @param expression 参数 expression。
 * @param vars 参数 vars。
 * @returns 返回 ValidationResult 类型结果。
 * 返回值示例：const result = validateVariableExpression('demo-value', { token: 'abc' }); // { ok: true }
 */
function validateVariableExpression(expression: string, vars: Record<string, unknown>): ValidationResult {
    // 变量：resolved，用于存储resolved。
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

/**
 * 方法：offsetToPosition
 * 说明：执行 offsetToPosition 相关处理逻辑。
 * @param text 参数 text。
 * @param offset 参数 offset。
 * @returns 返回 { line: number; character: number } 类型结果。
 * 返回值示例：const result = offsetToPosition('demo-value', 1); // { ok: true }
 */
function offsetToPosition(text: string, offset: number): { line: number; character: number } {
    // 变量：head，用于存储head。
    const head = text.slice(0, offset);
    // 变量：lines，用于存储lines。
    const lines = head.split('\n');
    return {
        line: lines.length - 1,
        character: lines[lines.length - 1]?.length ?? 0
    };
}
