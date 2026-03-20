import * as vscode from "vscode";
import { getFileContent } from "../core/filesystem/store";
import { ensureRequestPathWithoutExtension } from "../utils/path";
import { isVhtEditor } from "../utils/editor";
import { prepareRuntimeVariables } from "../core/runtime/variables";
import { DocumentAstCache } from "../core/vht/documentAstCache";
import { CompletionProvider } from "../core/vht/completion";
import { Diagnostics } from "../core/vht/diagnostics";
import { VariableDecorator } from "../core/vht/variableDecorator";
import { globContext, onDidChangeVhtVariables, refreshBaseVhtVariables } from "../context";

/**
 * 方法：registerLanguageFeatures
 * 说明：执行 registerLanguageFeatures 相关处理逻辑。
 * @param context 参数 context。
 * @param astCache 参数 astCache。
 * @param diagnostics 参数 diagnostics。
 * @param decorator 参数 decorator。
 * @returns 无返回值，通过副作用完成处理。
 * 返回值示例：registerLanguageFeatures({ ... }, { ... }, { ... }, { ... }); // undefined
 */
export function registerLanguageFeatures(
  context: vscode.ExtensionContext,
  astCache: DocumentAstCache,
  diagnostics: Diagnostics,
  decorator: VariableDecorator
): void {
  // 变量：selector，用于存储selector。
  const selector: vscode.DocumentSelector = [{ language: "vht" }];
  // 变量：completionProvider，用于存储补全provider。
  const completionProvider = vscode.languages.registerCompletionItemProvider(
    selector,
    new CompletionProvider(astCache),
    ...getCompletionTriggerChars()
  );

  context.subscriptions.push(astCache, diagnostics.getCollection(), completionProvider, decorator);
  context.subscriptions.push(...createDocumentSubscriptions(diagnostics, decorator));
  refreshActiveEditor(diagnostics, decorator);
}

/**
 * 方法：createDocumentSubscriptions
 * 说明：执行 createDocumentSubscriptions 相关处理逻辑。
 * @param diagnostics 参数 diagnostics。
 * @param decorator 参数 decorator。
 * @returns 返回 vscode.Disposable[] 列表。
 * 返回值示例：const list = createDocumentSubscriptions({ ... }, { ... }); // [{ id: 'demo' }]
 */
function createDocumentSubscriptions(
  diagnostics: Diagnostics,
  decorator: VariableDecorator
): vscode.Disposable[] {
  return [
    vscode.workspace.onDidChangeTextDocument(event => {
      diagnostics.scheduleUpdate(event.document, 140);
      if (vscode.window.activeTextEditor?.document.uri.toString() === event.document.uri.toString()) {
        decorator.update(vscode.window.activeTextEditor);
      }
    }),
    vscode.workspace.onDidCloseTextDocument(document => {
      diagnostics.clear(document);
    }),
    vscode.workspace.onDidSaveTextDocument(document => {
      if (isWorkspaceConfigDocument(document)) {
        refreshBaseVhtVariables(document.uri);
        refreshActiveEditor(diagnostics, decorator);
        return;
      }

      if (document.languageId === "vht") {
        void refreshRuntimeVariables(document);
      }
    }),
    vscode.window.onDidChangeTextEditorSelection(event => {
      if (isVhtEditor(event.textEditor)) {
        decorator.update(event.textEditor);
      }
    }),
    vscode.window.onDidChangeActiveTextEditor(() => {
      refreshActiveEditor(diagnostics, decorator);
    }),
    onDidChangeVhtVariables(documentUri => {
      // 变量：editor，用于存储编辑器。
      const editor = getActiveVhtEditor();
      if (!editor || (documentUri && editor.document.uri.toString() !== documentUri.toString())) {
        return;
      }
      diagnostics.update(editor.document);
      decorator.update(editor);
    })
  ];
}

/**
 * 方法：refreshRuntimeVariables
 * 说明：执行 refreshRuntimeVariables 相关处理逻辑。
 * @param document 参数 document。
 * @returns 异步完成后无返回值。
 * 返回值示例：await refreshRuntimeVariables(document); // undefined
 */
async function refreshRuntimeVariables(document: vscode.TextDocument): Promise<void> {
  // 变量：request，用于存储请求。
  const request = getFileContent(globContext.collections, ensureRequestPathWithoutExtension(document.uri.path));
  if (!request) {
    return;
  }

  try {
    await prepareRuntimeVariables(document.uri, request);
  } catch (error) {
    vscode.window.showWarningMessage(error instanceof Error ? error.message : String(error));
  }
}

/**
 * 方法：refreshActiveEditor
 * 说明：执行 refreshActiveEditor 相关处理逻辑。
 * @param diagnostics 参数 diagnostics。
 * @param decorator 参数 decorator。
 * @returns 无返回值，通过副作用完成处理。
 * 返回值示例：refreshActiveEditor({ ... }, { ... }); // undefined
 */
function refreshActiveEditor(diagnostics: Diagnostics, decorator: VariableDecorator): void {
  // 变量：editor，用于存储编辑器。
  const editor = getActiveVhtEditor();
  if (!editor) {
    return;
  }

  diagnostics.update(editor.document);
  decorator.update(editor);
}

/**
 * 方法：getActiveVhtEditor
 * 说明：执行 getActiveVhtEditor 相关处理逻辑。
 * @param 无 无参数。
 * @returns 命中时返回 vscode.TextEditor，未命中时返回 undefined。
 * 返回值示例：const result = getActiveVhtEditor(); // { ok: true } 或 undefined
 */
function getActiveVhtEditor(): vscode.TextEditor | undefined {
  // 变量：editor，用于存储编辑器。
  const editor = vscode.window.activeTextEditor;
  return isVhtEditor(editor) ? editor : undefined;
}

/**
 * 方法：isWorkspaceConfigDocument
 * 说明：执行 isWorkspaceConfigDocument 相关处理逻辑。
 * @param document 参数 document。
 * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
 * 返回值示例：const ok = isWorkspaceConfigDocument(document); // true
 */
function isWorkspaceConfigDocument(document: vscode.TextDocument): boolean {
  return document.fileName.endsWith("vortex.json");
}

/**
 * 方法：getCompletionTriggerChars
 * 说明：执行 getCompletionTriggerChars 相关处理逻辑。
 * @param 无 无参数。
 * @returns 返回 string[] 列表。
 * 返回值示例：const list = getCompletionTriggerChars(); // [{ id: 'demo' }]
 */
function getCompletionTriggerChars(): string[] {
  return [
    ":",
    " ",
    "-",
    ".",
    "[",
    "'",
    "\"",
    ..."abcdefghijklmnopqrstuvwxyz",
    ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  ];
}
