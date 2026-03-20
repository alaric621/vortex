import * as vscode from "vscode";
import type { Range as VhtRange } from "../core/vht/engine/parser/types";

/**
 * 方法：toVsCodeRange
 * 说明：执行 toVsCodeRange 相关处理逻辑。
 * @param range 参数 range。
 * @returns 返回 vscode.Range 类型结果。
 * 返回值示例：const result = toVsCodeRange({ ... }); // { ok: true }
 */
export function toVsCodeRange(range: VhtRange): vscode.Range {
  return new vscode.Range(
    range.start.line,
    range.start.character,
    range.end.line,
    range.end.character
  );
}

/**
 * 方法：rangeContainsPosition
 * 说明：执行 rangeContainsPosition 相关处理逻辑。
 * @param range 参数 range。
 * @param position 参数 position。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = rangeContainsPosition(range, position); // true
 */
export function rangeContainsPosition(range: vscode.Range, position: vscode.Position): boolean {
  return position.line >= range.start.line
    && position.line <= range.end.line
    && (position.line !== range.start.line || position.character >= range.start.character)
    && (position.line !== range.end.line || position.character <= range.end.character);
}
