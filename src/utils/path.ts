/**
 * 方法：normalizePath
 * 说明：执行 normalizePath 相关处理逻辑。
 * @param path 参数 path。
 * @returns 返回 string 类型结果。
 * 返回值示例：const text = normalizePath('demo-value'); // 'demo-value'
 */
export function normalizePath(path: string): string {
  // 变量：normalized，用于存储normalized。
  let normalized = path.replace(/\\/g, "/").trim();
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  normalized = normalized.replace(/\/{2,}/g, "/");
  if (normalized !== "/" && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * 方法：stripVhtSuffix
 * 说明：执行 stripVhtSuffix 相关处理逻辑。
 * @param path 参数 path。
 * @returns 返回 string 类型结果。
 * 返回值示例：const text = stripVhtSuffix('demo-value'); // 'demo-value'
 */
export function stripVhtSuffix(path: string): string {
  return path.endsWith(".vht") ? path.slice(0, -4) : path;
}

/**
 * 方法：ensureRequestPathWithoutExtension
 * 说明：执行 ensureRequestPathWithoutExtension 相关处理逻辑。
 * @param path 参数 path。
 * @returns 返回 string 类型结果。
 * 返回值示例：const text = ensureRequestPathWithoutExtension('demo-value'); // 'demo-value'
 */
export function ensureRequestPathWithoutExtension(path: string): string {
  // 变量：normalized，用于存储normalized。
  const normalized = normalizePath(path);
  return stripVhtSuffix(normalized);
}

/**
 * 方法：dirnamePath
 * 说明：执行 dirnamePath 相关处理逻辑。
 * @param path 参数 path。
 * @returns 返回 string 类型结果。
 * 返回值示例：const text = dirnamePath('demo-value'); // 'demo-value'
 */
export function dirnamePath(path: string): string {
  // 变量：normalized，用于存储normalized。
  const normalized = normalizePath(path);
  // 变量：parts，用于存储parts。
  const parts = normalized.split("/");
  parts.pop();
  // 变量：parent，用于存储parent。
  const parent = parts.join("/");
  return parent === "" ? "/" : parent;
}

/**
 * 方法：basenamePath
 * 说明：执行 basenamePath 相关处理逻辑。
 * @param path 参数 path。
 * @returns 返回 string 类型结果。
 * 返回值示例：const text = basenamePath('demo-value'); // 'demo-value'
 */
export function basenamePath(path: string): string {
  // 变量：normalized，用于存储normalized。
  const normalized = normalizePath(path);
  return normalized.split("/").pop() ?? "";
}

/**
 * 方法：joinPath
 * 说明：执行 joinPath 相关处理逻辑。
 * @param base 参数 base。
 * @param input 参数 input。
 * @returns 返回 string 类型结果。
 * 返回值示例：const text = joinPath('demo-value', 'demo-value'); // 'demo-value'
 */
export function joinPath(base: string, input: string): string {
  if (input.startsWith("/")) {
    return normalizePath(input);
  }
  if (base === "/") {
    return normalizePath(`/${input}`);
  }
  return normalizePath(`${base}/${input}`);
}
