import { VhtAST } from '../types';
import { collectBodyIssues } from './bodyRules';
import { collectHeaderIssues } from './headerRules';
import { collectRequestIssues } from './requestRules';
import { collectVariableIssues } from './variableRules';
import { VhtDiagnosticIssue } from './types';

/**
 * 方法：collectDiagnosticIssues
 * 说明：执行 collectDiagnosticIssues 相关处理逻辑。
 * @param ast 参数 ast。
 * @param text 参数 text。
 * @param variables 参数 variables。
 * @returns 返回 VhtDiagnosticIssue[] 列表。
 * 返回值示例：const list = collectDiagnosticIssues(ast, 'demo-value', { token: 'abc' }); // [{ id: 'demo' }]
 */
export function collectDiagnosticIssues(ast: VhtAST, text: string, variables?: Record<string, unknown>): VhtDiagnosticIssue[] {
    return [
        ...collectRequestIssues(ast, text),
        ...collectHeaderIssues(ast),
        ...collectBodyIssues(ast),
        ...collectVariableIssues(ast, text, variables)
    ];
}
