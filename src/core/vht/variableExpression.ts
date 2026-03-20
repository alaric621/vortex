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

/**
 * 方法：resolveVariableExpression
 * 说明：执行 resolveVariableExpression 相关处理逻辑。
 * @param expression 参数 expression。
 * @param vars 参数 vars。
 * @returns 返回 VariableResolution 类型结果。
 * 返回值示例：const result = resolveVariableExpression('demo-value', { token: 'abc' }); // { ok: true }
 */
export function resolveVariableExpression(expression: string, vars: Record<string, unknown>): VariableResolution {
  // 变量：parsed，用于存储parsed。
  const parsed = parseVariableExpression(expression);
  if ("error" in parsed) {
    return { kind: "syntax-error", message: parsed.error };
  }

  if (!(parsed.root in vars)) {
    return { kind: "unknown-path", path: parsed.root };
  }

  // 变量：current，用于存储current。
  let current: unknown = vars[parsed.root];
  // 变量：path，用于存储路径。
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

    // 变量：key，用于存储key。
    const key = String(token.index);
    if (!(key in current)) {
      return { kind: "unknown-path", path };
    }

    current = (current as Record<string, unknown>)[key];
  }

  return { kind: "resolved", value: current };
}

/**
 * 方法：parseVariableExpression
 * 说明：执行 parseVariableExpression 相关处理逻辑。
 * @param expression 参数 expression。
 * @returns 返回 ParseResult 类型结果。
 * 返回值示例：const result = parseVariableExpression('demo-value'); // { ok: true }
 */
function parseVariableExpression(expression: string): ParseResult {
  // 变量：source，用于存储source。
  const source = expression.trim();
  // 变量：i，用于存储i。
  let i = 0;

  skipSpaces();
  // 变量：root，用于存储根节点。
  const root = readIdentifier();
  if (!root) {
    return { error: "必须以变量名开头" };
  }

  // 变量：tokens，用于存储tokens。
  const tokens: ParsedToken[] = [];
  while (i < source.length) {
    skipSpaces();
    if (i >= source.length) break;

    if (source[i] === ".") {
      i++;
      skipSpaces();
      // 变量：key，用于存储key。
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

      // 变量：quote，用于存储quote。
      const quote = source[i];
      if (quote === "'" || quote === "\"") {
        i++;
        // 变量：keyStart，用于存储keystart。
        const keyStart = i;
        while (i < source.length && source[i] !== quote) {
          i++;
        }
        if (i >= source.length) {
          return { error: "字符串下标未闭合引号" };
        }
        // 变量：key，用于存储key。
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

      // 变量：indexStart，用于存储indexstart。
      const indexStart = i;
      while (i < source.length && isDigit(source[i])) {
        i++;
      }
      // 变量：rawIndex，用于存储rawindex。
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

  /**
   * 方法：readIdentifier
   * 说明：执行 readIdentifier 相关处理逻辑。
   * @param 无 无参数。
   * @returns 命中时返回 string，未命中时返回 undefined。
   * 返回值示例：const result = readIdentifier(); // 'demo-value' 或 undefined
   */
  function readIdentifier(): string | undefined {
    if (i >= source.length || !isIdentifierStart(source[i])) {
      return undefined;
    }
    // 变量：start，用于存储start。
    const start = i;
    i++;
    while (i < source.length && isIdentifierPart(source[i])) {
      i++;
    }
    return source.slice(start, i);
  }

  /**
   * 方法：skipSpaces
   * 说明：执行 skipSpaces 相关处理逻辑。
   * @param 无 无参数。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：skipSpaces(); // undefined
   */
  function skipSpaces(): void {
    while (i < source.length && /\s/.test(source[i])) {
      i++;
    }
  }
}

/**
 * 方法：isObjectLike
 * 说明：执行 isObjectLike 相关处理逻辑。
 * @param value 参数 value。
 * @returns 返回 value is Record<string, unknown> 类型结果。
 * 返回值示例：const result = isObjectLike({ ok: true }); // { ok: true }
 */
function isObjectLike(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

/**
 * 方法：describeValueType
 * 说明：执行 describeValueType 相关处理逻辑。
 * @param value 参数 value。
 * @returns 返回 string 类型结果。
 * 返回值示例：const text = describeValueType({ ok: true }); // 'demo-value'
 */
function describeValueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/**
 * 方法：isIdentifierStart
 * 说明：执行 isIdentifierStart 相关处理逻辑。
 * @param ch 参数 ch。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = isIdentifierStart('demo-value'); // true
 */
function isIdentifierStart(ch: string): boolean {
  return /[A-Za-z_$]/.test(ch);
}

/**
 * 方法：isIdentifierPart
 * 说明：执行 isIdentifierPart 相关处理逻辑。
 * @param ch 参数 ch。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = isIdentifierPart('demo-value'); // true
 */
function isIdentifierPart(ch: string): boolean {
  return /[A-Za-z0-9_$]/.test(ch);
}

/**
 * 方法：isDigit
 * 说明：执行 isDigit 相关处理逻辑。
 * @param ch 参数 ch。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = isDigit('demo-value'); // true
 */
function isDigit(ch: string): boolean {
  return /[0-9]/.test(ch);
}
