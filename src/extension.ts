import * as vscode from "vscode";
import { FileSystemProvider } from "./core/filesystem/FileSystemProvider";
import { ExplorerProvider } from "./views/explore";
import { VhtDiagnostics } from './core/vht/diagnostics';
import { VhtCompletionProvider } from './core/vht/completion';
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
  // 注册诊断（语法检查）
  context.subscriptions.push(diagnosticManager.getCollection());

  const fsProvider = new FileSystemProvider();
  const explorerProvider = new ExplorerProvider(scheme, authority);
  // 监听文档事件
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(e => diagnosticManager.update(e.document)),
  );

  // 初始检查
  if (vscode.window.activeTextEditor) {
    diagnosticManager.update(vscode.window.activeTextEditor.document);
  }

  const exploretreeView = vscode.window.createTreeView("vortex-explorer", {
    treeDataProvider: explorerProvider,
  });

  context.subscriptions.push(
    // 记得把 treeView 实例也加进来
    exploretreeView,
completionProvider,
    vscode.workspace.registerFileSystemProvider(scheme, fsProvider),

    vscode.commands.registerCommand("vortex.request.refresh", async () => {
      fsProvider.refresh();
      explorerProvider.refresh();
    }),
  )
}

export function deactivate(): void { }
