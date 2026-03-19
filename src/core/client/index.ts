import * as vscode from "vscode";
import { Collections } from "../../../typings/filesystem";

export interface ClientRequestPayload extends Partial<Collections> {
  id: string;
}

let outputChannel: vscode.OutputChannel | undefined;

function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel("Vortex Client");
  }
  return outputChannel;
}

function formatRequestSummary(param: ClientRequestPayload): string {
  const method = param.type ?? "GET";
  const name = param.name ?? param.id;
  const url = param.url ?? "<missing-url>";
  return `${method} ${name} -> ${url}`;
}

export async function send(param: ClientRequestPayload): Promise<void> {
  const channel = getOutputChannel();
  channel.appendLine(`[placeholder] send not implemented: ${formatRequestSummary(param)}`);
  channel.show(true);
  void vscode.window.showInformationMessage(
    `Vortex client is still a placeholder. Send is not implemented for ${param.name ?? param.id}.`
  );
}

export async function stop(id: string): Promise<void> {
  const channel = getOutputChannel();
  channel.appendLine(`[placeholder] stop not implemented: ${id}`);
  channel.show(true);
  void vscode.window.showInformationMessage(
    `Vortex client is still a placeholder. Stop is not implemented for ${id}.`
  );
}

export default send;
