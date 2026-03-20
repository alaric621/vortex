import * as vscode from "vscode";

export interface ClientLogView {
  appendLine(value: string): void;
  show(preserveFocus?: boolean): void;
  clear(): void;
}

// 变量：CLIENT_OUTPUT_CHANNEL_NAME，用于存储客户端输出channel名称。
const CLIENT_OUTPUT_CHANNEL_NAME = "Vortex";
// 变量：CLIENT_OUTPUT_LANGUAGE_ID，用于存储客户端输出languageid。
const CLIENT_OUTPUT_LANGUAGE_ID = "vortex-log";

// 变量：clientOutputChannel，用于存储客户端输出channel。
let clientOutputChannel: vscode.OutputChannel | undefined;

/**
 * 方法：getClientPanel
 * 说明：执行 getClientPanel 相关处理逻辑。
 * @param 无 无参数。
 * @returns 返回 ClientLogView 类型结果。
 * 返回值示例：const result = getClientPanel(); // { ok: true }
 */
export function getClientPanel(): ClientLogView {
  if (!clientOutputChannel) {
    clientOutputChannel = vscode.window.createOutputChannel(CLIENT_OUTPUT_CHANNEL_NAME, CLIENT_OUTPUT_LANGUAGE_ID);
  }
  return clientOutputChannel;
}
