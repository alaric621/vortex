import { describe, expect, it } from 'vitest';
import { VhtParser } from '../src/core/vht/parser';
import { collectDiagnosticIssues } from '../src/core/vht/diagnosticsRules';

describe('VHT 诊断规则', () => {
    const parser = new VhtParser();

    it('应报告重复请求头和空请求头值', () => {
        const text = `GET http://localhost
Accept:
accept: application/json`;
        const ast = parser.parse(text);
        const issues = collectDiagnosticIssues(ast, text);

        expect(issues.some(i => i.code === 'empty-header-value')).toBe(true);
        expect(issues.some(i => i.code === 'duplicate-header')).toBe(true);
    });

    it('存在正文但缺少请求行时应报告错误', () => {
        const text = `hello body`;
        const ast = parser.parse(text);
        const issues = collectDiagnosticIssues(ast, text);

        expect(issues.some(i => i.code === 'missing-request-line')).toBe(true);
        expect(issues.some(i => i.code === 'body-without-request')).toBe(true);
    });

    it('只有脚本段时不应报告缺少请求行', () => {
        const text = `>>>
console.log("pre")`;
        const ast = parser.parse(text);
        const issues = collectDiagnosticIssues(ast, text);

        expect(issues.some(i => i.code === 'missing-request-line')).toBe(false);
    });

    it('请求头枚举值非法时应报告错误', () => {
        const text = `GET http://localhost
DNT: 2`;
        const ast = parser.parse(text);
        const issues = collectDiagnosticIssues(ast, text);

        expect(issues.some(i => i.code === 'invalid-enum-header-value')).toBe(true);
    });

    it('合法的 CSV 枚举请求头值不应报错', () => {
        const text = `GET http://localhost
Connection: keep-alive, upgrade`;
        const ast = parser.parse(text);
        const issues = collectDiagnosticIssues(ast, text);

        expect(issues.some(i => i.code === 'invalid-enum-header-value')).toBe(false);
    });

    it('Sec-CH-UA-Mobile 非法值应报告错误', () => {
        const text = `GET http://localhost
Sec-CH-UA-Mobile: true`;
        const ast = parser.parse(text);
        const issues = collectDiagnosticIssues(ast, text);

        expect(issues.some(i => i.code === 'invalid-enum-header-value')).toBe(true);
    });

    it('带 q 参数的 TE 合法值不应报错', () => {
        const text = `GET http://localhost
TE: trailers, gzip;q=0.8`;
        const ast = parser.parse(text);
        const issues = collectDiagnosticIssues(ast, text);

        expect(issues.some(i => i.code === 'invalid-enum-header-value')).toBe(false);
    });

    it('应支持带路径和 HTTP 版本的请求行', () => {
        const text = `GET /user/name HTTP/1.1
Content-Type: application/json`;
        const ast = parser.parse(text);
        const issues = collectDiagnosticIssues(ast, text);

        expect(String(ast.sections.request?.data?.url)).toBe('/user/name');
        expect(String(ast.sections.request?.data?.version)).toBe('HTTP/1.1');
        expect(issues.some(i => i.code === 'missing-request-url')).toBe(false);
        expect(issues.some(i => i.code === 'invalid-request-version')).toBe(false);
    });

    it('请求行 HTTP 版本非法时应报告错误', () => {
        const text = `GET /user/name HTTP/ABC`;
        const ast = parser.parse(text);
        const issues = collectDiagnosticIssues(ast, text);

        expect(issues.some(i => i.code === 'invalid-request-version')).toBe(true);
    });

    it('变量起始标记未闭合时应报告错误', () => {
        const text = `GET http://localhost
Authorization: Bearer {{name`;
        const ast = parser.parse(text);
        const issues = collectDiagnosticIssues(ast, text);

        expect(issues.some(i => i.code === 'unclosed-variable-open')).toBe(true);
    });

    it('未知变量路径应报告警告', () => {
        const text = `GET http://localhost
Authorization: Bearer {{client['missing']}}`;
        const ast = parser.parse(text);
        const issues = collectDiagnosticIssues(ast, text);

        expect(issues.some(i => i.code === 'unknown-variable-path')).toBe(true);
    });

    it('变量表达式语法非法应报告错误', () => {
        const text = `GET http://localhost
Authorization: Bearer {{env[]}}`;
        const ast = parser.parse(text);
        const issues = collectDiagnosticIssues(ast, text);

        expect(issues.some(i => i.code === 'invalid-variable-expression')).toBe(true);
        expect(issues.some(i => i.code === 'unknown-variable-path')).toBe(false);
    });

    it('基础类型变量被错误下标访问时应报告错误', () => {
        const text = `GET http://localhost
Authorization: Bearer {{env['name']}}`;
        const ast = parser.parse(text);
        const issues = collectDiagnosticIssues(ast, text);

        expect(issues.some(i => i.code === 'invalid-variable-type-access')).toBe(true);
    });
});
