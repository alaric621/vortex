import { Range } from '../parser/types';

export interface DiagnosticIssue {
    range: Range;
    message: string;
    code: string;
    severity: 'error' | 'warning' | 'info';
    source?: string;
}
