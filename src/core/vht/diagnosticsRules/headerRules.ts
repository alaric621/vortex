import { VhtAST } from '../types';
import { VhtDiagnosticIssue } from './types';

type HeaderValueValidator = (value: string) => boolean;

const ENUM_HEADER_RULES: Record<string, { values: string[]; mode?: 'single' | 'csv' }> = {
    'dnt': { values: ['0', '1', 'null'] },
    'save-data': { values: ['on'] },
    'upgrade-insecure-requests': { values: ['0', '1'] },
    'sec-fetch-mode': { values: ['cors', 'navigate', 'no-cors', 'same-origin', 'websocket'] },
    'sec-fetch-site': { values: ['same-origin', 'same-site', 'cross-site', 'none'] },
    'sec-fetch-user': { values: ['?1'] },
    'sec-fetch-dest': {
        values: [
            'document', 'empty', 'audio', 'font', 'image', 'manifest', 'script',
            'style', 'track', 'video', 'worker', 'sharedworker', 'serviceworker',
            'report', 'object', 'embed', 'nested-document'
        ]
    },
    'connection': { values: ['keep-alive', 'close', 'upgrade'], mode: 'csv' },
    'upgrade': { values: ['websocket', 'h2c'] },
    'sec-websocket-version': { values: ['13'] },
    'sec-ch-ua-mobile': { values: ['?0', '?1'] },
    'sec-ch-ua-platform': {
        values: ['Android', 'Chrome OS', 'Chromium OS', 'iOS', 'Linux', 'macOS', 'Windows', 'Unknown']
    },
    'sec-gpc': { values: ['1'] }
};

export function collectHeaderIssues(ast: VhtAST): VhtDiagnosticIssue[] {
    const issues: VhtDiagnosticIssue[] = [];
    const seen = new Map<string, number>();

    for (const header of ast.sections.headers) {
        const key = String(header.data?.key ?? '').trim();
        const value = String(header.data?.value ?? '');
        const normalized = key.toLowerCase();

        if (!key) {
            issues.push({
                range: header.range,
                message: 'Header Key 不能为空。',
                code: 'empty-header-key',
                severity: 'error',
                source: 'VHT Rules'
            });
            continue;
        }

        if (seen.has(normalized)) {
            issues.push({
                range: header.range,
                message: `重复的 Header: ${key}。`,
                code: 'duplicate-header',
                severity: 'warning',
                source: 'VHT Rules'
            });
        } else {
            seen.set(normalized, header.range.start.line);
        }

        if (value.trim() === '') {
            issues.push({
                range: header.range,
                message: `Header "${key}" 的值为空。`,
                code: 'empty-header-value',
                severity: 'warning',
                source: 'VHT Rules'
            });
            continue;
        }

        const validator = createHeaderValueValidator(normalized);
        if (validator && !validator(value)) {
            const allowed = ENUM_HEADER_RULES[normalized]?.values.join(', ') ?? '规范值';
            issues.push({
                range: header.range,
                message: `Header "${key}" 的值 "${value}" 不合法。允许值: ${allowed}。`,
                code: 'invalid-enum-header-value',
                severity: 'error',
                source: 'VHT Rules'
            });
        }
    }

    return issues;
}

function createHeaderValueValidator(headerKey: string): HeaderValueValidator | undefined {
    const special = createSpecialValidator(headerKey);
    if (special) return special;

    return createEnumValidator(headerKey);
}

function createEnumValidator(headerKey: string): HeaderValueValidator | undefined {
    const rule = ENUM_HEADER_RULES[headerKey];
    if (!rule) return undefined;

    const allowed = new Set(rule.values.map(value => normalizeEnumValue(value)));
    const mode = rule.mode ?? 'single';

    return (value: string) => {
        const normalizedValue = normalizeEnumValue(value);
        if (mode === 'single') {
            return allowed.has(normalizedValue);
        }

        const tokens = normalizedValue
            .split(',')
            .map(token => token.trim())
            .filter(Boolean);
        if (tokens.length === 0) return false;

        return tokens.every(token => allowed.has(token));
    };
}

function createSpecialValidator(headerKey: string): HeaderValueValidator | undefined {
    if (headerKey === 'te') {
        return validateTEValue;
    }
    if (headerKey === 'access-control-request-method') {
        return validateHttpToken;
    }
    if (headerKey === 'access-control-request-headers') {
        return validateHeaderNameCsv;
    }
    return undefined;
}

function validateTEValue(value: string): boolean {
    const normalized = value.trim();
    if (!normalized) return false;

    const parts = normalized.split(',').map(part => part.trim()).filter(Boolean);
    if (parts.length === 0) return false;

    for (const part of parts) {
        const [codingRaw] = part.split(';', 1);
        const coding = normalizeEnumValue(codingRaw);
        if (!coding) return false;

        if (coding !== 'trailers' && coding !== 'compress' && coding !== 'deflate' && coding !== 'gzip') {
            return false;
        }
    }
    return true;
}

function validateHttpToken(value: string): boolean {
    return /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(value.trim());
}

function validateHeaderNameCsv(value: string): boolean {
    const tokens = value.split(',').map(token => token.trim()).filter(Boolean);
    if (tokens.length === 0) return false;
    return tokens.every(token => /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(token));
}

function normalizeEnumValue(value: string): string {
    return value.trim().replace(/^"(.*)"$/, '$1').toLowerCase();
}
