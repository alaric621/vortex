import { ASTNode, AST, Range } from './types';

export class Parser {
    // 完美的匹配正则
    private readonly REGEX_REQUEST = /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE|WEBSOCKET|SSE|EVENTSOURCE|SUBSCRIBE|UNSUBSCRIBE)\s+(.+)$/;
    // 简单的 Header 正则
    private readonly REGEX_HEADER = /^([\w-]+)\s*:\s*(.*)$/;
    // 变量：REGEX_VARIABLE，用于存储regex变量。
    private readonly REGEX_VARIABLE = /\{\{([\s\S]*?)\}\}/g;

    /**
     * 方法：parse
     * 说明：执行 parse 相关处理逻辑。
     * @param text 参数 text。
     * @returns 返回 VhtAST 类型结果。
     * 返回值示例：const result = parse('demo-value'); // { ok: true }
     */
    public parse(text: string): AST {
        // 变量：normalizedText，用于存储normalizedtext。
        const normalizedText = text.replace(/\r\n/g, '\n');
        // 变量：lines，用于存储lines。
        const lines = normalizedText.split('\n');
        // 变量：ast，用于存储语法树。
        const ast = this.createAst();
        this.collectVariables(normalizedText, ast);
        // 变量：i，用于存储i。
        let i = 0;

        while (i < lines.length) {
            // 变量：line，用于存储行。
            const line = lines[i];
            // 变量：trimmed，用于存储trimmed。
            const trimmed = line.trim();
            if (trimmed === "") {
                i++;
                continue;
            }
            if (this.isScriptDelimiter(trimmed)) {
                i = this.parseScriptBlock(lines, i, this.getScriptType(trimmed), ast);
                continue;
            }
            if (this.isRequestStart(lines, i, ast)) {
                i = this.parseRequestAndHeaders(lines, i, ast);
                continue;
            }
            i = this.parseBodyBlock(lines, i, ast);
        }

        return ast;
    }

    /**
     * 方法：parseRequestAndHeaders
     * 说明：执行 parseRequestAndHeaders 相关处理逻辑。
     * @param lines 参数 lines。
     * @param start 参数 start。
     * @param ast 参数 ast。
     * @returns 返回 number 类型结果。
     * 返回值示例：const count = parseRequestAndHeaders([], 1, ast); // 1
     */
    private parseRequestAndHeaders(lines: string[], start: number, ast: AST): number {
        // 变量：firstLine，用于存储first行。
        const firstLine = lines[start];
        // 变量：requestLine，用于存储请求行。
        const requestLine = this.parseRequestLine(firstLine);
        // 变量：requestNode，用于存储请求节点。
        const requestNode = this.createRequestNode(start, firstLine, requestLine);
        ast.nodes.push(requestNode);
        ast.sections.request = requestNode;

        // 变量：current，用于存储current。
        let current = start + 1;
        while (current < lines.length) {
            // 变量：line，用于存储行。
            const line = lines[current];
            // 变量：trimmed，用于存储trimmed。
            const trimmed = line.trim();
            if (trimmed === "") {
                current++;
                break;
            }
            if (this.isScriptDelimiter(trimmed)) {
                this.pushMissingBlankLineError(ast, current, line.length, trimmed);
                break;
            }
            // 变量：headerNode，用于存储header节点。
            const headerNode = this.createHeaderNode(current, line);
            if (!headerNode) {
                this.pushInvalidHeaderError(ast, current, line.length);
                current++;
                continue;
            }

            ast.nodes.push(headerNode);
            ast.sections.headers.push(headerNode);
            current++;
        }
        return current;
    }

    /**
     * 方法：parseScriptBlock
     * 说明：执行 parseScriptBlock 相关处理逻辑。
     * @param lines 参数 lines。
     * @param start 参数 start。
     * @param type 参数 type。
     * @param ast 参数 ast。
     * @returns 返回 number 类型结果。
     * 返回值示例：const count = parseScriptBlock([], 1, 'PreScript', ast); // 1
     */
    private parseScriptBlock(lines: string[], start: number, type: 'PreScript' | 'PostScript', ast: AST): number {
        // 变量：current，用于存储current。
        let current = start + 1;
        // 变量：contentStart，用于存储内容start。
        const contentStart = current;
        
        while (current < lines.length) {
            // 变量：line，用于存储行。
            const line = lines[current].trim();
            if (this.isScriptDelimiter(line) || this.REGEX_REQUEST.test(lines[current])) break;
            current++;
        }
        
        // 变量：scriptNode，用于存储script节点。
        const scriptNode: ASTNode = {
            type,
            range: this.createRange(start, 0, current - 1, lines[current - 1]?.length || 0),
            raw: lines.slice(contentStart, current).join('\n')
        };
        ast.nodes.push(scriptNode);
        if (type === 'PreScript') {
            ast.sections.scripts.pre = scriptNode;
        } else {
            ast.sections.scripts.post = scriptNode;
        }
        return current;
    }

    /**
     * 方法：parseBodyBlock
     * 说明：执行 parseBodyBlock 相关处理逻辑。
     * @param lines 参数 lines。
     * @param start 参数 start。
     * @param ast 参数 ast。
     * @returns 返回 number 类型结果。
     * 返回值示例：const count = parseBodyBlock([], 1, ast); // 1
     */
    private parseBodyBlock(lines: string[], start: number, ast: AST): number {
        // 变量：current，用于存储current。
        let current = start;
        // 变量：contentStart，用于存储内容start。
        const contentStart = current;
        
        while (current < lines.length) {
            // 变量：line，用于存储行。
            const line = lines[current];
            if (this.isScriptDelimiter(line.trim()) || this.REGEX_REQUEST.test(line)) break;
            current++;
        }

        // 变量：bodyNode，用于存储正文节点。
        const bodyNode: ASTNode = {
            type: 'Body',
            range: this.createRange(start, 0, current - 1, lines[current - 1]?.length || 0),
            raw: lines.slice(contentStart, current).join('\n')
        };
        ast.nodes.push(bodyNode);
        ast.sections.body = bodyNode;
        return current;
    }

    /**
     * 方法：createRange
     * 说明：执行 createRange 相关处理逻辑。
     * @param sL 参数 sL。
     * @param sC 参数 sC。
     * @param eL 参数 eL。
     * @param eC 参数 eC。
     * @returns 返回 Range 类型结果。
     * 返回值示例：const result = createRange(1, 1, 1, 1); // { ok: true }
     */
    private createRange(sL: number, sC: number, eL: number, eC: number): Range {
        return { 
            start: { line: sL, character: sC }, 
            end: { line: eL, character: eC } 
        };
    }

    /**
     * 方法：createAst
     * 说明：执行 createAst 相关处理逻辑。
     * @param 无 无参数。
     * @returns 返回 VhtAST 类型结果。
     * 返回值示例：const result = createAst(); // { ok: true }
     */
    private createAst(): AST {
        return {
            nodes: [],
            errors: [],
            sections: {
                headers: [],
                scripts: {}
            },
            variables: []
        };
    }

    /**
     * 方法：isScriptDelimiter
     * 说明：执行 isScriptDelimiter 相关处理逻辑。
     * @param value 参数 value。
     * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
     * 返回值示例：const ok = isScriptDelimiter('demo-value'); // true
     */
    private isScriptDelimiter(value: string): boolean {
        return value === '>>>' || value === '<<<';
    }

    /**
     * 方法：getScriptType
     * 说明：执行 getScriptType 相关处理逻辑。
     * @param value 参数 value。
     * @returns 返回 'PreScript' | 'PostScript' 类型结果。
     * 返回值示例：const result = getScriptType('demo-value'); // { ok: true }
     */
    private getScriptType(value: string): 'PreScript' | 'PostScript' {
        return value === '>>>' ? 'PreScript' : 'PostScript';
    }

    /**
     * 方法：isRequestStart
     * 说明：执行 isRequestStart 相关处理逻辑。
     * @param lines 参数 lines。
     * @param index 参数 index。
     * @param ast 参数 ast。
     * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
     * 返回值示例：const ok = isRequestStart([], 1, ast); // true
     */
    private isRequestStart(lines: string[], index: number, ast: AST): boolean {
        // 变量：line，用于存储行。
        const line = lines[index];
        // 变量：trimmed，用于存储trimmed。
        const trimmed = line.trim();
        // 变量：isStandardRequest，用于存储isstandard请求。
        const isStandardRequest = this.REGEX_REQUEST.test(line);
        // 变量：isMethodPrefix，用于存储is方法prefix。
        const isMethodPrefix = /^[A-Za-z]+$/.test(trimmed) && !trimmed.includes(':');
        // 变量：isInitialLine，用于存储isinitial行。
        const isInitialLine = ast.nodes.length === 0 || (index > 0 && lines[index - 1].trim() === "");
        return isStandardRequest || (isInitialLine && isMethodPrefix);
    }

    /**
     * 方法：createRequestNode
     * 说明：执行 createRequestNode 相关处理逻辑。
     * @param lineIndex 参数 lineIndex。
     * @param raw 参数 raw。
     * @param requestLine 参数 requestLine。
     * @returns 返回 ASTNode 类型结果。
     * 返回值示例：const result = createRequestNode(1, 'demo-value', { ... }); // { ok: true }
     */
    private createRequestNode(
        lineIndex: number,
        raw: string,
        requestLine: { method: string; url: string; version: string }
    ): ASTNode {
        return {
            type: 'RequestLine',
            range: this.createRange(lineIndex, 0, lineIndex, raw.length),
            raw,
            data: requestLine
        };
    }

    /**
     * 方法：createHeaderNode
     * 说明：执行 createHeaderNode 相关处理逻辑。
     * @param lineIndex 参数 lineIndex。
     * @param raw 参数 raw。
     * @returns 命中时返回 ASTNode，未命中时返回 undefined。
     * 返回值示例：const result = createHeaderNode(1, 'demo-value'); // { ok: true } 或 undefined
     */
    private createHeaderNode(lineIndex: number, raw: string): ASTNode | undefined {
        // 变量：match，用于存储match。
        const match = raw.match(this.REGEX_HEADER);
        if (!match) {
            return undefined;
        }

        return {
            type: 'Header',
            range: this.createRange(lineIndex, 0, lineIndex, raw.length),
            raw,
            data: { key: match[1], value: match[2] }
        };
    }

    /**
     * 方法：pushMissingBlankLineError
     * 说明：执行 pushMissingBlankLineError 相关处理逻辑。
     * @param ast 参数 ast。
     * @param line 参数 line。
     * @param length 参数 length。
     * @param token 参数 token。
     * @returns 无返回值，通过副作用完成处理。
     * 返回值示例：pushMissingBlankLineError(ast, 1, 1, 'demo-value'); // undefined
     */
    private pushMissingBlankLineError(ast: AST, line: number, length: number, token: string): void {
        ast.errors.push({
            range: this.createRange(line, 0, line, length),
            message: `语法错误: 在拦截器 "${token}" 之前缺少必要的空行。`
        });
    }

    /**
     * 方法：pushInvalidHeaderError
     * 说明：执行 pushInvalidHeaderError 相关处理逻辑。
     * @param ast 参数 ast。
     * @param line 参数 line。
     * @param length 参数 length。
     * @returns 无返回值，通过副作用完成处理。
     * 返回值示例：pushInvalidHeaderError(ast, 1, 1); // undefined
     */
    private pushInvalidHeaderError(ast: AST, line: number, length: number): void {
        ast.errors.push({
            range: this.createRange(line, 0, line, length),
            message: "无效的 Header 格式，预期为 'Key: Value'。"
        });
    }

    /**
     * 方法：collectVariables
     * 说明：执行 collectVariables 相关处理逻辑。
     * @param text 参数 text。
     * @param ast 参数 ast。
     * @returns 无返回值，通过副作用完成处理。
     * 返回值示例：collectVariables('demo-value', ast); // undefined
     */
    private collectVariables(text: string, ast: AST): void {
        // 变量：lineStarts，用于存储行starts。
        const lineStarts = this.buildLineStartOffsets(text);

        for (const match of text.matchAll(this.REGEX_VARIABLE)) {
            // 变量：raw，用于存储raw。
            const raw = match[0];
            // 变量：expression，用于存储表达式。
            const expression = (match[1] ?? '').trim();
            // 变量：offset，用于存储offset。
            const offset = match.index;
            if (offset === undefined) continue;

            // 变量：start，用于存储start。
            const start = this.offsetToPosition(offset, lineStarts);
            // 变量：end，用于存储end。
            const end = this.offsetToPosition(offset + raw.length, lineStarts);
            ast.variables.push({
                expression,
                raw,
                range: { start, end }
            });
        }
    }

    /**
     * 方法：buildLineStartOffsets
     * 说明：执行 buildLineStartOffsets 相关处理逻辑。
     * @param text 参数 text。
     * @returns 返回 number[] 列表。
     * 返回值示例：const list = buildLineStartOffsets('demo-value'); // [{ id: 'demo' }]
     */
    private buildLineStartOffsets(text: string): number[] {
        // 变量：starts，用于存储starts。
        const starts = [0];
        for (let i = 0; i < text.length; i++) {
            if (text[i] === '\n') {
                starts.push(i + 1);
            }
        }
        return starts;
    }

    /**
     * 方法：offsetToPosition
     * 说明：执行 offsetToPosition 相关处理逻辑。
     * @param offset 参数 offset。
     * @param lineStarts 参数 lineStarts。
     * @returns 返回 { line: number; character: number } 类型结果。
     * 返回值示例：const result = offsetToPosition(1, []); // { ok: true }
     */
    private offsetToPosition(offset: number, lineStarts: number[]): { line: number; character: number } {
        // 变量：low，用于存储low。
        let low = 0;
        // 变量：high，用于存储high。
        let high = lineStarts.length - 1;

        while (low <= high) {
            // 变量：mid，用于存储mid。
            const mid = (low + high) >> 1;
            // 变量：start，用于存储start。
            const start = lineStarts[mid];
            // 变量：next，用于存储next。
            const next = mid + 1 < lineStarts.length ? lineStarts[mid + 1] : Number.MAX_SAFE_INTEGER;
            if (offset < start) {
                high = mid - 1;
            } else if (offset >= next) {
                low = mid + 1;
            } else {
                return { line: mid, character: offset - start };
            }
        }

        // 变量：lastLine，用于存储last行。
        const lastLine = Math.max(0, lineStarts.length - 1);
        return { line: lastLine, character: Math.max(0, offset - lineStarts[lastLine]) };
    }

    /**
     * 方法：parseRequestLine
     * 说明：执行 parseRequestLine 相关处理逻辑。
     * @param line 参数 line。
     * @returns 返回 { method: string; url: string; version: string } 类型结果。
     * 返回值示例：const result = parseRequestLine('demo-value'); // { ok: true }
     */
    private parseRequestLine(line: string): { method: string; url: string; version: string } {
        // 变量：trimmed，用于存储trimmed。
        const trimmed = line.trim();
        if (!trimmed) {
            return { method: '', url: '', version: '' };
        }

        // 变量：parts，用于存储parts。
        const parts = trimmed.split(/\s+/);
        // 变量：method，用于存储方法。
        const method = parts[0] ?? '';
        if (parts.length <= 1) {
            return { method, url: '', version: '' };
        }

        // 变量：maybeVersion，用于存储maybeversion。
        const maybeVersion = parts[parts.length - 1] ?? '';
        // 变量：hasHttpPrefix，用于存储hashttpprefix。
        const hasHttpPrefix = /^HTTP\//i.test(maybeVersion);
        // 变量：version，用于存储version。
        const version = hasHttpPrefix ? maybeVersion.toUpperCase() : '';
        // 变量：urlParts，用于存储地址parts。
        const urlParts = hasHttpPrefix ? parts.slice(1, -1) : parts.slice(1);
        // 变量：url，用于存储地址。
        const url = urlParts.join(' ');

        return { method, url, version };
    }
}
