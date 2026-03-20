import * as vscode from "vscode";

/**
 * 方法：isLanguageEditor
 * 说明：执行 isLanguageEditor 相关处理逻辑。
 * @param editor 参数 editor。
 * @param languageId 参数 languageId。
 * @returns 返回 editor is vscode.TextEditor 类型结果。
 * 返回值示例：const result = isLanguageEditor(editor, 'demo-value'); // { ok: true }
 */
export function isLanguageEditor(
  editor: vscode.TextEditor | undefined,
  languageId: string
): editor is vscode.TextEditor {
  return Boolean(editor?.document.languageId === languageId);
}

/**
 * 方法：isVhtEditor
 * 说明：执行 isVhtEditor 相关处理逻辑。
 * @param editor 参数 editor。
 * @returns 返回 editor is vscode.TextEditor 类型结果。
 * 返回值示例：const result = isVhtEditor(editor); // { ok: true }
 */
export function isVhtEditor(editor: vscode.TextEditor | undefined): editor is vscode.TextEditor {
  return isLanguageEditor(editor, "vht");
}
