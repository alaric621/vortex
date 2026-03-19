import { ASTNode, VhtAST, Range } from './types';

export class VhtParser {
    // 完美的匹配正则
    private readonly REGEX_REQUEST = /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE|WEBSOCKET|SSE|EVENTSOURCE|SUBSCRIBE|UNSUBSCRIBE)\s+(.+)$/;
    // 简单的 Header 正则
    private readonly REGEX_HEADER = /^([\w-]+)\s*:\s*(.*)$/;

    public parse(text: string): VhtAST {
        const lines = text.replace(/\r\n/g, '\n').split('\n');
        const ast: VhtAST = {
            nodes: [],
            errors: [],
            sections: {
                headers: [],
                scripts: {}
            }
        };
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];
            const trimmed = line.trim();

            // 跳过空行
            if (trimmed === "") {
                i++;
                continue;
            }

            // 1. 拦截器判断 (优先级最高)
            if (trimmed === '>>>' || trimmed === '<<<') {
                i = this.parseScriptBlock(lines, i, trimmed === '>>>' ? 'PreScript' : 'PostScript', ast);
                continue;
            }

            // 2. 严谨的 RequestLine 预判逻辑
            // 满足以下任一条件即视为 RequestLine:
            // a. 符合标准正则 (GET http://...)
            // b. 处于文件开头/脚本后，且全是字母大写 (如 GE, POS)，且不含冒号
            const isStandardRequest = this.REGEX_REQUEST.test(line);
            const isMethodPrefix = /^[A-Za-z]+$/.test(trimmed) && !trimmed.includes(':');

            // 如果是第一行，或者是紧随脚本/空行之后的非空行
            const isInitialLine = ast.nodes.length === 0 || (i > 0 && lines[i-1].trim() === "");

            if (isStandardRequest || (isInitialLine && isMethodPrefix)) {
                i = this.parseRequestAndHeaders(lines, i, ast);
                continue;
            }

            // 3. 兜底逻辑：视为 Body
            i = this.parseBodyBlock(lines, i, ast);
        }

        return ast;
    }

    private parseRequestAndHeaders(lines: string[], start: number, ast: VhtAST): number {
        const firstLine = lines[start];
        const requestLine = this.parseRequestLine(firstLine);
        
        // 即使只有 "GE"，也存入数据，方便补全
        const requestNode: ASTNode = {
            type: 'RequestLine',
            range: this.createRange(start, 0, start, firstLine.length),
            raw: firstLine,
            data: { 
                method: requestLine.method,
                url: requestLine.url,
                version: requestLine.version
            }
        };
        ast.nodes.push(requestNode);
        ast.sections.request = requestNode;

        let current = start + 1;
        while (current < lines.length) {
            const line = lines[current];
            const trimmed = line.trim();

            // 遇到空行：Header 区域正常结束
            if (trimmed === "") {
                current++;
                break;
            }

            // 严谨校验：如果直接撞见拦截器，说明少了空行，强制报错并切断
            if (trimmed === '>>>' || trimmed === '<<<') {
                ast.errors.push({
                    range: this.createRange(current, 0, current, line.length),
                    message: `语法错误: 在拦截器 "${trimmed}" 之前缺少必要的空行。`
                });
                break; 
            }

            const hMatch = line.match(this.REGEX_HEADER);
            if (hMatch) {
                const headerNode: ASTNode = {
                    type: 'Header',
                    range: this.createRange(current, 0, current, line.length),
                    raw: line,
                    data: { key: hMatch[1], value: hMatch[2] }
                };
                ast.nodes.push(headerNode);
                ast.sections.headers.push(headerNode);
            } else {
                // 如果在 Request 下方既不是 Header 也不是空行，报语法错
                ast.errors.push({
                    range: this.createRange(current, 0, current, line.length),
                    message: "无效的 Header 格式，预期为 'Key: Value'。"
                });
            }
            current++;
        }
        return current;
    }

    private parseScriptBlock(lines: string[], start: number, type: 'PreScript' | 'PostScript', ast: VhtAST): number {
        let current = start + 1;
        const contentStart = current;
        
        while (current < lines.length) {
            const line = lines[current].trim();
            // 脚本结束于下一个标记或新的请求行
            if (line === ">>>" || line === "<<<" || this.REGEX_REQUEST.test(lines[current])) break;
            current++;
        }
        
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

    private parseBodyBlock(lines: string[], start: number, ast: VhtAST): number {
        let current = start;
        const contentStart = current;
        
        while (current < lines.length) {
            const line = lines[current];
            // Body 结束于下一个标记或新的请求行
            if (line.trim() === ">>>" || line.trim() === "<<<" || this.REGEX_REQUEST.test(line)) break;
            current++;
        }

        const bodyNode: ASTNode = {
            type: 'Body',
            range: this.createRange(start, 0, current - 1, lines[current - 1]?.length || 0),
            raw: lines.slice(contentStart, current).join('\n')
        };
        ast.nodes.push(bodyNode);
        ast.sections.body = bodyNode;
        return current;
    }

    private createRange(sL: number, sC: number, eL: number, eC: number): Range {
        return { 
            start: { line: sL, character: sC }, 
            end: { line: eL, character: eC } 
        };
    }

    private parseRequestLine(line: string): { method: string; url: string; version: string } {
        const trimmed = line.trim();
        if (!trimmed) {
            return { method: '', url: '', version: '' };
        }

        const parts = trimmed.split(/\s+/);
        const method = parts[0] ?? '';
        if (parts.length <= 1) {
            return { method, url: '', version: '' };
        }

        const maybeVersion = parts[parts.length - 1] ?? '';
        const hasHttpPrefix = /^HTTP\//i.test(maybeVersion);
        const version = hasHttpPrefix ? maybeVersion.toUpperCase() : '';
        const urlParts = hasHttpPrefix ? parts.slice(1, -1) : parts.slice(1);
        const url = urlParts.join(' ');

        return { method, url, version };
    }
}
