import * as vscode from "vscode";
import { FileSystemProvider } from "@/core/filesystem/FileSystemProvider";
import { ExplorerProvider } from "./views/explore";
import {exploreCreate,exploreDelete,exploreRename,exploreSend,exploreStop} from "./command/explore"

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const scheme = "vortex-fs";
  const authority = "request";
  
  const fsProvider = new FileSystemProvider();
  const explorerProvider = new ExplorerProvider(scheme, authority);

  const clearListSelection = async (): Promise<void> => {
    try {
      await vscode.commands.executeCommand("list.clear");
    } catch {
      // Ignore when list context is not active.
    }
  };
  const ensureListSelected = async (): Promise<void> => {
    try {
      await vscode.commands.executeCommand("list.selectAndPreserveFocus");
    } catch {
      // Ignore when list context is not active.
    }
  };
  
  const exploretreeView = vscode.window.createTreeView("vortex-explorer", {
    treeDataProvider: explorerProvider,
  });
 
   exploretreeView.onDidCollapseElement(e=>{
     console.log(e);
   })
   exploretreeView.onDidChangeCheckboxState(e=>{
     console.log(e);
   })
   exploretreeView.onDidChangeVisibility(e=>{
     console.log(e);
     
   })
  context.subscriptions.push(
    // 记得把 treeView 实例也加进来
    exploretreeView, 

    vscode.workspace.registerFileSystemProvider(scheme, fsProvider),
    
    vscode.commands.registerCommand("vortex.request.refresh", async () => {
      fsProvider.refresh();
      explorerProvider.refresh();
    }),

    // 进阶写法：如果右键没传 node，尝试从 treeView 的选中状态里取
    // 顶部按钮/命令面板：始终在根目录创建
    vscode.commands.registerCommand("vortex.request.create", async () => {
      await clearListSelection();
      await exploreCreate(undefined);
    }),

    vscode.commands.registerCommand("vortex.request.rename", async (node) => {
      await ensureListSelected();
      await exploreRename(node || exploretreeView.selection[0]);
    }),
    vscode.commands.registerCommand("vortex.request.delete", async (node) => {
      
      await exploreDelete(node || exploretreeView.selection[0]);
    }),
    vscode.commands.registerCommand("vortex.request.send", async (node) => {
      await exploreSend(node || exploretreeView.selection[0]);
    }),
    vscode.commands.registerCommand("vortex.request.stop", () => exploreStop()),
  );
}

export function deactivate(): void { }
