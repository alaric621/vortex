type ParsedToken = { kind: "property"; key: string } | { kind: "index"; index: number };

type ParseResult = {
  root: string;
  tokens: ParsedToken[];
} | {
  error: string;
};

export type VariableResolution =
  | { kind: "resolved"; value: unknown }
  | { kind: "syntax-error"; message: string }
  | { kind: "invalid-type-access"; message: string }
  | { kind: "unknown-path"; path: string };

export function resolveVariableExpression(expression: string, vars: Record<string, unknown>): VariableResolution {
  const parsed = parseVariableExpression(expression);
  if ("error" in parsed) {
    return { kind: "syntax-error", message: parsed.error };
  }

  if (!(parsed.root in vars)) {
    return { kind: "unknown-path", path: parsed.root };
  }

  let current: unknown = vars[parsed.root];
  let path = parsed.root;

  for (const token of parsed.tokens) {
    if (token.kind === "property") {
      path += `.${token.key}`;

      if (!isObjectLike(current)) {
        return {
          kind: "invalid-type-access",
          message: `${path} 的上一级是 ${describeValueType(current)}，不支持属性访问`
        };
      }

      if (!(token.key in current)) {
        return { kind: "unknown-path", path };
      }

      current = (current as Record<string, unknown>)[token.key];
      continue;
    }

    path += `[${token.index}]`;

    if (Array.isArray(current)) {
      if (token.index < 0 || token.index >= current.length) {
        return { kind: "unknown-path", path };
      }
      current = current[token.index];
      continue;
    }

    if (!isObjectLike(current)) {
      return {
        kind: "invalid-type-access",
        message: `${path} 的上一级是 ${describeValueType(current)}，不支持下标访问`
      };
    }

    const key = String(token.index);
    if (!(key in current)) {
      return { kind: "unknown-path", path };
    }

    current = (current as Record<string, unknown>)[key];
  }

  return { kind: "resolved", value: current };
}

function parseVariableExpression(expression: string): ParseResult {
  const source = expression.trim();
  let i = 0;

  skipSpaces();
  const root = readIdentifier();
  if (!root) {
    return { error: "必须以变量名开头" };
  }

  const tokens: ParsedToken[] = [];
  while (i < source.length) {
    skipSpaces();
    if (i >= source.length) break;

    if (source[i] === ".") {
      i++;
      skipSpaces();
      const key = readIdentifier();
      if (!key) {
        return { error: "点号后必须是属性名" };
      }
      tokens.push({ kind: "property", key });
      continue;
    }

    if (source[i] === "[") {
      i++;
      skipSpaces();
      if (i >= source.length) {
        return { error: "下标表达式未闭合" };
      }

      const quote = source[i];
      if (quote === "'" || quote === "\"") {
        i++;
        const keyStart = i;
        while (i < source.length && source[i] !== quote) {
          i++;
        }
        if (i >= source.length) {
          return { error: "字符串下标未闭合引号" };
        }
        const key = source.slice(keyStart, i).trim();
        if (!key) {
          return { error: "字符串下标不能为空" };
        }
        i++;
        skipSpaces();
        if (source[i] !== "]") {
          return { error: "下标表达式缺少 ]" };
        }
        i++;
        tokens.push({ kind: "property", key });
        continue;
      }

      const indexStart = i;
      while (i < source.length && isDigit(source[i])) {
        i++;
      }
      const rawIndex = source.slice(indexStart, i);
      if (!rawIndex) {
        return { error: "下标必须是数字或字符串" };
      }
      skipSpaces();
      if (source[i] !== "]") {
        return { error: "下标表达式缺少 ]" };
      }
      i++;
      tokens.push({ kind: "index", index: Number(rawIndex) });
      continue;
    }

    return { error: `非法字符 "${source[i]}"` };
  }

  return { root, tokens };

  function readIdentifier(): string | undefined {
    if (i >= source.length || !isIdentifierStart(source[i])) {
      return undefined;
    }
    const start = i;
    i++;
    while (i < source.length && isIdentifierPart(source[i])) {
      i++;
    }
    return source.slice(start, i);
  }

  function skipSpaces(): void {
    while (i < source.length && /\s/.test(source[i])) {
      i++;
    }
  }
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function describeValueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function isIdentifierStart(ch: string): boolean {
  return /[A-Za-z_$]/.test(ch);
}

function isIdentifierPart(ch: string): boolean {
  return /[A-Za-z0-9_$]/.test(ch);
}

function isDigit(ch: string): boolean {
  return /[0-9]/.test(ch);
}
