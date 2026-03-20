import { VhtAST } from '../parser/types';
import { VhtDiagnosticIssue } from './types';

type HeaderValueValidator = (value: string) => boolean;

// 变量：ENUM_HEADER_RULES，用于存储enumheaderrules。
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

/**
 * 方法：collectHeaderIssues
 * 说明：执行 collectHeaderIssues 相关处理逻辑。
 * @param ast 参数 ast。
 * @returns 返回 VhtDiagnosticIssue[] 列表。
 * 返回值示例：const list = collectHeaderIssues(ast); // [{ id: 'demo' }]
 */
export function collectHeaderIssues(ast: VhtAST): VhtDiagnosticIssue[] {
    // 变量：issues，用于存储issues。
    const issues: VhtDiagnosticIssue[] = [];
    // 变量：seen，用于存储seen。
    const seen = new Map<string, number>();

    for (const header of ast.sections.headers) {
        // 变量：key，用于存储key。
        const key = String(header.data?.key ?? '').trim();
        // 变量：value，用于存储value。
        const value = String(header.data?.value ?? '');
        // 变量：normalized，用于存储normalized。
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

        // 变量：validator，用于存储validator。
        const validator = createHeaderValueValidator(normalized);
        if (validator && !validator(value)) {
            // 变量：allowed，用于存储allowed。
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

/**
 * 方法：createHeaderValueValidator
 * 说明：执行 createHeaderValueValidator 相关处理逻辑。
 * @param headerKey 参数 headerKey。
 * @returns 命中时返回 HeaderValueValidator，未命中时返回 undefined。
 * 返回值示例：const result = createHeaderValueValidator('demo-value'); // { ok: true } 或 undefined
 */
function createHeaderValueValidator(headerKey: string): HeaderValueValidator | undefined {
    // 变量：special，用于存储special。
    const special = createSpecialValidator(headerKey);
    if (special) return special;

    return createEnumValidator(headerKey);
}

/**
 * 方法：createEnumValidator
 * 说明：执行 createEnumValidator 相关处理逻辑。
 * @param headerKey 参数 headerKey。
 * @returns 命中时返回 HeaderValueValidator，未命中时返回 undefined。
 * 返回值示例：const result = createEnumValidator('demo-value'); // { ok: true } 或 undefined
 */
function createEnumValidator(headerKey: string): HeaderValueValidator | undefined {
    // 变量：rule，用于存储rule。
    const rule = ENUM_HEADER_RULES[headerKey];
    if (!rule) return undefined;

    // 变量：allowed，用于存储allowed。
    const allowed = new Set(rule.values.map(value => normalizeEnumValue(value)));
    // 变量：mode，用于存储mode。
    const mode = rule.mode ?? 'single';

    return (value: string) => {
        // 变量：normalizedValue，用于存储normalizedvalue。
        const normalizedValue = normalizeEnumValue(value);
        if (mode === 'single') {
            return allowed.has(normalizedValue);
        }

        // 变量：tokens，用于存储tokens。
        const tokens = normalizedValue
            .split(',')
            .map(token => token.trim())
            .filter(Boolean);
        if (tokens.length === 0) return false;

        return tokens.every(token => allowed.has(token));
    };
}

/**
 * 方法：createSpecialValidator
 * 说明：执行 createSpecialValidator 相关处理逻辑。
 * @param headerKey 参数 headerKey。
 * @returns 命中时返回 HeaderValueValidator，未命中时返回 undefined。
 * 返回值示例：const result = createSpecialValidator('demo-value'); // { ok: true } 或 undefined
 */
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

/**
 * 方法：validateTEValue
 * 说明：执行 validateTEValue 相关处理逻辑。
 * @param value 参数 value。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = validateTEValue('demo-value'); // true
 */
function validateTEValue(value: string): boolean {
    // 变量：normalized，用于存储normalized。
    const normalized = value.trim();
    if (!normalized) return false;

    // 变量：parts，用于存储parts。
    const parts = normalized.split(',').map(part => part.trim()).filter(Boolean);
    if (parts.length === 0) return false;

    for (const part of parts) {
        const [codingRaw] = part.split(';', 1);
        // 变量：coding，用于存储coding。
        const coding = normalizeEnumValue(codingRaw);
        if (!coding) return false;

        if (coding !== 'trailers' && coding !== 'compress' && coding !== 'deflate' && coding !== 'gzip') {
            return false;
        }
    }
    return true;
}

/**
 * 方法：validateHttpToken
 * 说明：执行 validateHttpToken 相关处理逻辑。
 * @param value 参数 value。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = validateHttpToken('demo-value'); // true
 */
function validateHttpToken(value: string): boolean {
    return /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(value.trim());
}

/**
 * 方法：validateHeaderNameCsv
 * 说明：执行 validateHeaderNameCsv 相关处理逻辑。
 * @param value 参数 value。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = validateHeaderNameCsv('demo-value'); // true
 */
function validateHeaderNameCsv(value: string): boolean {
    // 变量：tokens，用于存储tokens。
    const tokens = value.split(',').map(token => token.trim()).filter(Boolean);
    if (tokens.length === 0) return false;
    return tokens.every(token => /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(token));
}

/**
 * 方法：normalizeEnumValue
 * 说明：执行 normalizeEnumValue 相关处理逻辑。
 * @param value 参数 value。
 * @returns 返回 string 类型结果。
 * 返回值示例：const text = normalizeEnumValue('demo-value'); // 'demo-value'
 */
function normalizeEnumValue(value: string): string {
    return value.trim().replace(/^"(.*)"$/, '$1').toLowerCase();
}
