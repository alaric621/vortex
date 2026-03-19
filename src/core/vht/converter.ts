import { VhtAST } from './types';

/**
 * 这里的 Collections 对应你项目中的数据结构
 */
export interface Collections {
    type: string;     // HTTP Method (GET, POST, etc.)
    url: string;
    headers: Record<string, string>;
    body: string;
    scripts: {
        pre: string;
        post: string;
    };
}

export class VhtConverter {
    /**
     * 将解析出的 AST 转换为结构化的 JSON 对象
     * 严谨点：处理多个相同类型的节点合并（如 Body 分多行解析的情况）
     */
    public astToJson(ast: VhtAST): Collections {
        const result: Collections = {
            type: 'GET',
            url: '',
            headers: {},
            body: '',
            scripts: { pre: '', post: '' }
        };

        ast.nodes.forEach(node => {
            switch (node.type) {
                case 'RequestLine':
                    if (node.data) {
                        result.type = node.data.method || 'GET';
                        result.url = node.data.url || '';
                    } else {
                        const [method = 'GET', url = ''] = node.raw.trim().split(/\s+/, 2);
                        result.type = method;
                        result.url = url;
                    }
                    break;

                case 'Header':
                    if (node.data && node.data.key) {
                        result.headers[node.data.key] = node.data.value;
                    }
                    break;

                case 'Body':
                    // 如果存在多个 Body 块，通过换行符进行物理合并
                    const trimmedBody = node.raw.trim();
                    if (trimmedBody) {
                        result.body += (result.body ? '\n' : '') + trimmedBody;
                    }
                    break;

                case 'PreScript':
                    result.scripts.pre = node.raw.trim();
                    break;

                case 'PostScript':
                    result.scripts.post = node.raw.trim();
                    break;
            }
        });

        return result;
    }

    /**
     * 将 JSON 对象转换为规范的 VHT 字符串
     * 核心严谨逻辑：强制执行“Header 与脚本/Body 之间必须有空行”的规则
     */
    public jsonToVht(json: Partial<Collections>): string {
        const lines: string[] = [];

        // 1. 请求行 (强制大写)
        const method = (json.type || 'GET').toUpperCase();
        const url = json.url || 'http://localhost:3000';
        lines.push(`${method} ${url}`);

        // 2. Headers (按字母顺序排序，保证生成的 VHT 文件版本控制友好)
        if (json.headers) {
            const sortedKeys = Object.keys(json.headers).sort();
            sortedKeys.forEach(key => {
                lines.push(`${key}: ${json.headers![key]}`);
            });
        }

        // 3. 关键：Header 之后必须紧跟一个空行
        lines.push("");

        // 4. Body 处理
        if (json.body && json.body.trim()) {
            lines.push(json.body.trim());
            lines.push(""); // Body 后增加空行分隔后续脚本
        }

        // 5. 前置脚本 (>>>)
        if (json.scripts?.pre && json.scripts.pre.trim()) {
            lines.push(">>>");
            lines.push(json.scripts.pre.trim());
            lines.push(""); // 脚本块后留空
        }

        // 6. 后置脚本 (<<<)
        if (json.scripts?.post && json.scripts.post.trim()) {
            lines.push("<<<");
            lines.push(json.scripts.post.trim());
        }

        // 最终清理：移除末尾多余空行并确保以单换行符结尾
        return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
    }
}
