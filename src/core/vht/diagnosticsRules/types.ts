import { Range } from '../parser/types';

export interface VhtDiagnosticIssue {
    range: Range;
    message: string;
    code: string;
    severity: 'error' | 'warning' | 'info';
    source?: string;
}
