import { Collections } from "../../../typings/filesystem";

export interface VhtAst {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  scripts: {
    pre: string;
    post: string;
  };
}

function normalizeEol(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function ensureSingleMarker(lines: string[], marker: ">>>" | "<<<"): number {
  const indexes: number[] = [];
  lines.forEach((line, index) => {
    if (line.trim() === marker) {
      indexes.push(index);
    }
  });

  if (indexes.length > 1) {
    throw new Error(`Invalid VHT format: duplicated marker "${marker}"`);
  }

  return indexes[0] ?? -1;
}

function parseRequestLine(line: string): { method: string; url: string } {
  const match = line.trim().match(/^([A-Za-z]+)\s+(.+)$/);
  if (!match) {
    throw new Error("Invalid VHT format: request line must be 'METHOD URL'");
  }

  return {
    method: match[1].toUpperCase(),
    url: match[2].trim()
  };
}

function parseMainSection(lines: string[]): { method: string; url: string; headers: Record<string, string>; body: string } {
  const firstNonEmptyIndex = lines.findIndex(line => line.trim() !== "");
  if (firstNonEmptyIndex === -1) {
    throw new Error("Invalid VHT format: request line is required");
  }

  const { method, url } = parseRequestLine(lines[firstNonEmptyIndex]);
  const headers: Record<string, string> = {};
  const bodyLines: string[] = [];

  let inHeaders = true;
  for (const line of lines.slice(firstNonEmptyIndex + 1)) {
    if (inHeaders) {
      if (line.trim() === "") {
        inHeaders = false;
        continue;
      }

      const headerMatch = line.match(/^([^:\s][^:]*)\s*:\s*(.*)$/);
      if (!headerMatch) {
        throw new Error(`Invalid VHT format: malformed header line "${line}"`);
      }

      headers[headerMatch[1].trim()] = headerMatch[2];
      continue;
    }

    bodyLines.push(line);
  }

  return {
    method,
    url,
    headers,
    body: bodyLines.join("\n").trimEnd()
  };
}

function extractScripts(lines: string[], preMarkerIndex: number, postMarkerIndex: number): { pre: string; post: string } {
  if (preMarkerIndex !== -1 && postMarkerIndex !== -1 && preMarkerIndex > postMarkerIndex) {
    throw new Error("Invalid VHT format: >>> marker must appear before <<< marker");
  }

  const pre = preMarkerIndex === -1
    ? ""
    : lines
      .slice(preMarkerIndex + 1, postMarkerIndex === -1 ? lines.length : postMarkerIndex)
      .join("\n")
      .trim();

  const post = postMarkerIndex === -1
    ? ""
    : lines
      .slice(postMarkerIndex + 1)
      .join("\n")
      .trim();

  return { pre, post };
}

function parseVht(code: string): VhtAst {
  const normalized = normalizeEol(code);
  const lines = normalized.split("\n");
  const preMarkerIndex = ensureSingleMarker(lines, ">>>");
  const postMarkerIndex = ensureSingleMarker(lines, "<<<");
  const sectionEnd = [preMarkerIndex, postMarkerIndex]
    .filter(index => index !== -1)
    .reduce((min, current) => Math.min(min, current), lines.length);

  const request = parseMainSection(lines.slice(0, sectionEnd));
  const scripts = extractScripts(lines, preMarkerIndex, postMarkerIndex);

  return {
    ...request,
    scripts
  };
}

/**
 * 返回 ast
 * @param code vht 代码
 */
export function transform(code: string): VhtAst {
  return parseVht(code);
}

export function parserJsonToVht(request: Partial<Collections>): string {
  if (!request.type || !request.url) {
    throw new Error("Invalid request json: both type and url are required");
  }

  const lines: string[] = [`${request.type.toUpperCase()} ${request.url}`];
  const headers = request.headers ?? {};
  for (const [key, value] of Object.entries(headers)) {
    lines.push(`${key}: ${value}`);
  }

  lines.push("");

  if (typeof request.body === "string" && request.body.length > 0) {
    lines.push(request.body);
  }

  const pre = request.scripts?.pre?.trim() ?? "";
  const post = request.scripts?.post?.trim() ?? "";

  if (pre) {
    lines.push("");
    lines.push(">>>");
    lines.push(pre);
  }

  if (post) {
    lines.push("");
    lines.push("<<<");
    lines.push(post);
  }

  return lines.join("\n").trimEnd() + "\n";
}

// Backward-compatible alias for existing imports.
export const paserJsonToVht = parserJsonToVht;

/**
 * 将简单的 .http 文本格式解析为 Collections 对象
 */
export function parseVhtToJson(text: string): Partial<Collections> {
  const ast = parseVht(text);
  return {
    type: ast.method,
    url: ast.url,
    headers: ast.headers,
    body: ast.body,
    scripts: {
      pre: ast.scripts.pre,
      post: ast.scripts.post
    }
  };
}
