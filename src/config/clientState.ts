import * as vscode from "vscode";
import { isClientBusy, onDidChangeClientState } from "../core/client";
import { Diagnostics } from "../core/vht/diagnostics";
import { VariableDecorator } from "../core/vht/decorators";
import { ExplorerProvider } from "../views/explore";

/**
 * 方法：registerClientState
 * 说明：执行 registerClientState 相关处理逻辑。
 * @param context 参数 context。
 * @param explorer 参数 explorer。
 * @param diagnostics 参数 diagnostics。
 * @param decorator 参数 decorator。
 * @returns 异步完成后无返回值。
 * 返回值示例：await registerClientState({ ... }, { ... }, { ... }, { ... }); // undefined
 */
export async function registerClientState(
  context: vscode.ExtensionContext,
  explorer: ExplorerProvider,
  diagnostics: Diagnostics,
  decorator: VariableDecorator
): Promise<void> {
  // 变量：applyClientContext，用于存储apply客户端context。
  const applyClientContext = async (): Promise<void> => {
    await vscode.commands.executeCommand("setContext", "vortex.client.busy", isClientBusy());
  };

  await applyClientContext();
  context.subscriptions.push(
    onDidChangeClientState(() => {
      void applyClientContext();
      explorer.refresh();
    })
  );
}
