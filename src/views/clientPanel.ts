import * as vscode from "vscode";

export interface ClientLogView {
  appendLine(value: string): void;
  show(preserveFocus?: boolean): void;
  clear(): void;
}

const CLIENT_OUTPUT_CHANNEL_NAME = "Vortex";
const CLIENT_OUTPUT_LANGUAGE_ID = "vortex-log";

let clientOutputChannel: vscode.OutputChannel | undefined;

export function getClientPanel(): ClientLogView {
  if (!clientOutputChannel) {
    clientOutputChannel = vscode.window.createOutputChannel(CLIENT_OUTPUT_CHANNEL_NAME, CLIENT_OUTPUT_LANGUAGE_ID);
  }
  return clientOutputChannel;
}
