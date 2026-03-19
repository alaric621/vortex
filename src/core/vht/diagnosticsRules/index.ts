import { VhtAST } from '../types';
import { collectBodyIssues } from './bodyRules';
import { collectHeaderIssues } from './headerRules';
import { collectRequestIssues } from './requestRules';
import { collectVariableIssues } from './variableRules';
import { VhtDiagnosticIssue } from './types';

export function collectDiagnosticIssues(ast: VhtAST, text: string, variables?: Record<string, unknown>): VhtDiagnosticIssue[] {
    return [
        ...collectRequestIssues(ast, text),
        ...collectHeaderIssues(ast),
        ...collectBodyIssues(ast),
        ...collectVariableIssues(ast, text, variables)
    ];
}
