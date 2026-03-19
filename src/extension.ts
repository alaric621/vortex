import * as vscode from "vscode";
import { FileSystemProvider } from "./core/filesystem/FileSystemProvider";
import { ExplorerProvider } from "./views/explore";
import { VhtDiagnostics } from './core/vht/diagnostics';
import { VhtCompletionProvider } from './core/vht/completion';
import { VariableDecorator } from './core/vht/variableDecorator';
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const scheme = "vortex-fs";
  const authority = "request";
  const diagnosticManager = new VhtDiagnostics();
  const selector: vscode.DocumentSelector = [
    { language: 'vht' } // 覆盖 file / untitled / 自定义 scheme
  ];
  const completionTriggerChars = [
    ':',
    ' ',
    '-',
    ...'abcdefghijklmnopqrstuvwxyz',
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  ];

  // 1. 注册自动补全
  const completionProvider = vscode.languages.registerCompletionItemProvider(
    selector,
    new VhtCompletionProvider(),
    ...completionTriggerChars
  );
  const variableDecorator = new VariableDecorator();
  // 注册诊断（语法检查）
  context.subscriptions.push(diagnosticManager.getCollection());

  const fsProvider = new FileSystemProvider();
  const explorerProvider = new ExplorerProvider(scheme, authority);
  // 监听文档事件
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(e => {
      diagnosticManager.update(e.document);
      const active = vscode.window.activeTextEditor;
      if (active && active.document.uri.toString() === e.document.uri.toString()) {
        variableDecorator.scheduleUpdate(active, 56);
      }
    }),
    vscode.window.onDidChangeTextEditorSelection(e => {
      if (e.textEditor.document.languageId !== 'vht') return;
      variableDecorator.scheduleUpdate(e.textEditor, 24);
    }),
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (!editor) return;
      diagnosticManager.update(editor.document);
      variableDecorator.scheduleUpdate(editor, 0);
    })
  );

  // 初始检查
  if (vscode.window.activeTextEditor) {
    diagnosticManager.update(vscode.window.activeTextEditor.document);
    variableDecorator.scheduleUpdate(vscode.window.activeTextEditor, 0);
  }

  const exploretreeView = vscode.window.createTreeView("vortex-explorer", {
    treeDataProvider: explorerProvider,
  });

  context.subscriptions.push(
    // 记得把 treeView 实例也加进来
    exploretreeView,
    completionProvider,
    variableDecorator,
    vscode.workspace.registerFileSystemProvider(scheme, fsProvider),

    vscode.commands.registerCommand("vortex.request.refresh", async () => {
      fsProvider.refresh();
      explorerProvider.refresh();
    }),
  )
}

export function deactivate(): void { }
