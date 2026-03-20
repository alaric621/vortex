// vht/types.ts

export interface Position {
    line: number;      // 0-based
    character: number; // 0-based
}

export interface Range {
    start: Position;
    end: Position;
}

export type NodeType = 'RequestLine' | 'Header' | 'Body' | 'PreScript' | 'PostScript' | 'Unknown';

export interface ASTNode {
    type: NodeType;
    range: Range;      // 物理位置：核心修改
    raw: string;       // 原始文本内容
    data?: any;        // 结构化数据，例如 { method: 'GET', url: '...' }
}

export interface VhtSections {
    request?: ASTNode;
    headers: ASTNode[];
    body?: ASTNode;
    scripts: {
        pre?: ASTNode;
        post?: ASTNode;
    };
}

export interface VhtVariableNode {
    expression: string;
    raw: string;
    range: Range;
}

export interface VhtAST {
    nodes: ASTNode[];
    errors: { range: Range; message: string }[];
    sections: VhtSections;
    variables: VhtVariableNode[];
}

/**
 * 工具函数：根据光标位置查找节点
 */
/**
 * 方法：findNodeAtPosition
 * 说明：执行 findNodeAtPosition 相关处理逻辑。
 * @param nodes 参数 nodes。
 * @param line 参数 line。
 * @param character 参数 character。
 * @returns 命中时返回 ASTNode，未命中时返回 undefined。
 * 返回值示例：const result = findNodeAtPosition([], 1, 1); // { ok: true } 或 undefined
 */
export function findNodeAtPosition(nodes: ASTNode[], line: number, character: number): ASTNode | undefined {
    // 变量：matched，用于存储matched。
    const matched = nodes.filter(node => {
        if (line < node.range.start.line || line > node.range.end.line) return false;
        if (line === node.range.start.line && character < node.range.start.character) return false;
        if (line === node.range.end.line && character > node.range.end.character) return false;
        return true;
    });

    if (matched.length === 0) return undefined;

    // 变量：requestNode，用于存储请求节点。
    const requestNode = matched.find(node => node.type === 'RequestLine');
    if (requestNode) return requestNode;

    // 变量：nonBodyNode，用于存储non正文节点。
    const nonBodyNode = matched.find(node => node.type !== 'Body');
    if (nonBodyNode) return nonBodyNode;

    // 当仅命中 Body，且文档里还没有 RequestLine 时，不把它当上下文节点。
    // 这样首行输入阶段可以继续触发方法模板补全。
    const hasRequestLine = nodes.some(node => node.type === 'RequestLine');
    if (!hasRequestLine) return undefined;

    return matched[0];
}
