import { describe, expect, it } from 'vitest';
import { VhtParser } from '../src/core/vht/parser';
import { collectDiagnosticIssues } from '../src/core/vht/diagnosticsRules';

describe('VHT diagnostics rules', () => {
    const parser = new VhtParser();

    it('reports duplicate and empty header value', () => {
        const text = `GET http://localhost
Accept:
accept: application/json`;
        const ast = parser.parse(text);
        const issues = collectDiagnosticIssues(ast, text);

        expect(issues.some(i => i.code === 'empty-header-value')).toBe(true);
        expect(issues.some(i => i.code === 'duplicate-header')).toBe(true);
    });

    it('reports missing request line when body exists', () => {
        const text = `hello body`;
        const ast = parser.parse(text);
        const issues = collectDiagnosticIssues(ast, text);

        expect(issues.some(i => i.code === 'missing-request-line')).toBe(true);
        expect(issues.some(i => i.code === 'body-without-request')).toBe(true);
    });

    it('does not report missing request line for standalone scripts', () => {
        const text = `>>>
console.log("pre")`;
        const ast = parser.parse(text);
        const issues = collectDiagnosticIssues(ast, text);

        expect(issues.some(i => i.code === 'missing-request-line')).toBe(false);
    });

    it('reports invalid enum header value', () => {
        const text = `GET http://localhost
DNT: 2`;
        const ast = parser.parse(text);
        const issues = collectDiagnosticIssues(ast, text);

        expect(issues.some(i => i.code === 'invalid-enum-header-value')).toBe(true);
    });

    it('accepts valid csv enum header value', () => {
        const text = `GET http://localhost
Connection: keep-alive, upgrade`;
        const ast = parser.parse(text);
        const issues = collectDiagnosticIssues(ast, text);

        expect(issues.some(i => i.code === 'invalid-enum-header-value')).toBe(false);
    });

    it('reports invalid sec-ch-ua-mobile value', () => {
        const text = `GET http://localhost
Sec-CH-UA-Mobile: true`;
        const ast = parser.parse(text);
        const issues = collectDiagnosticIssues(ast, text);

        expect(issues.some(i => i.code === 'invalid-enum-header-value')).toBe(true);
    });

    it('accepts valid TE value with q params', () => {
        const text = `GET http://localhost
TE: trailers, gzip;q=0.8`;
        const ast = parser.parse(text);
        const issues = collectDiagnosticIssues(ast, text);

        expect(issues.some(i => i.code === 'invalid-enum-header-value')).toBe(false);
    });

    it('supports request line with path and HTTP version', () => {
        const text = `GET /user/name HTTP/1.1
Content-Type: application/json`;
        const ast = parser.parse(text);
        const issues = collectDiagnosticIssues(ast, text);

        expect(String(ast.sections.request?.data?.url)).toBe('/user/name');
        expect(String(ast.sections.request?.data?.version)).toBe('HTTP/1.1');
        expect(issues.some(i => i.code === 'missing-request-url')).toBe(false);
        expect(issues.some(i => i.code === 'invalid-request-version')).toBe(false);
    });

    it('reports invalid HTTP version in request line', () => {
        const text = `GET /user/name HTTP/ABC`;
        const ast = parser.parse(text);
        const issues = collectDiagnosticIssues(ast, text);

        expect(issues.some(i => i.code === 'invalid-request-version')).toBe(true);
    });
});
