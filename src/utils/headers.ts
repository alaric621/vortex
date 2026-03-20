/**
 * 方法：toHeadersRecord
 * 说明：执行 toHeadersRecord 相关处理逻辑。
 * @param headers 参数 headers。
 * @returns 返回 Record<string, string> 类型结果。
 * 返回值示例：const result = toHeadersRecord({ ... }); // { ok: true }
 */
export function toHeadersRecord(headers: Headers): Record<string, string> {
  // 变量：output，用于存储输出。
  const output: Record<string, string> = {};
  headers.forEach((value, key) => {
    output[key] = value;
  });
  return output;
}
