import { describe, expect, it, vi } from 'vitest';
import { VhtParser } from '../src/core/vht/parser';
import { VhtConverter } from '../src/core/vht/converter';

vi.mock('vscode', () => {
      return {
            Range: class {
                  public start: { line: number; character: number };
                  public end: { line: number; character: number };
                  constructor(
                        public startLine: number,
                        public startChar: number,
                        public endLine: number,
                        public endChar: number
                  ) {
                        this.start = { line: startLine, character: startChar };
                        this.end = { line: endLine, character: endChar };
                  }
            }
      };
});

describe('VhtConverter AST 转换测试', () => {
      const parser = new VhtParser();
      const converter = new VhtConverter();

      it('应该优先使用结构化 sections 转换 AST', () => {
            const code = `POST http://localhost:3000/user
Content-Type: application/json
Authorization: Bearer abc

{"name":"vortex"}
>>>
console.log("pre")
<<<
console.log("post")`;

            const ast = parser.parse(code);
            const json = converter.astToJson(ast);

            expect(json.type).toBe('POST');
            expect(json.url).toBe('http://localhost:3000/user');
            expect(json.headers).toEqual({
                  'Content-Type': 'application/json',
                  Authorization: 'Bearer abc'
            });
            expect(json.body).toBe('{"name":"vortex"}');
            expect(json.scripts?.pre).toBe('console.log("pre")');
            expect(json.scripts?.post).toBe('console.log("post")');
      });

      it('应该兼容旧 AST（无 sections）', () => {
            const legacyAst: any = {
                  nodes: [
                        { type: 'RequestLine', raw: 'GET http://example.com', range: { startLine: 0, startChar: 0, endLine: 0, endChar: 22 } },
                        { type: 'Header', raw: 'A: B', data: { key: 'A', value: 'B' }, range: { startLine: 1, startChar: 0, endLine: 1, endChar: 4 } },
                        { type: 'Body', raw: 'hello', range: { startLine: 3, startChar: 0, endLine: 3, endChar: 5 } }
                  ],
                  errors: []
            };

            const json = converter.astToJson(legacyAst);
            expect(json.type).toBe('GET');
            expect(json.url).toBe('http://example.com');
            expect(json.headers).toEqual({ A: 'B' });
            expect(json.body).toBe('hello');
      });
});
