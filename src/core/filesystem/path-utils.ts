export function normalizePath(path: string): string {
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

export function stripVhtSuffix(path: string): string {
  return path.endsWith(".vht") ? path.slice(0, -4) : path;
}

export function ensureRequestPathWithoutExtension(path: string): string {
  const normalized = normalizePath(path);
  return stripVhtSuffix(normalized);
}

export function dirnamePath(path: string): string {
  const normalized = normalizePath(path);
  const parts = normalized.split("/");
  parts.pop();
  const parent = parts.join("/");
  return parent === "" ? "/" : parent;
}

export function basenamePath(path: string): string {
  const normalized = normalizePath(path);
  return normalized.split("/").pop() ?? "";
}

export function joinPath(base: string, input: string): string {
  if (input.startsWith("/")) {
    return normalizePath(input);
  }
  if (base === "/") {
    return normalizePath(`/${input}`);
  }
  return normalizePath(`${base}/${input}`);
}
