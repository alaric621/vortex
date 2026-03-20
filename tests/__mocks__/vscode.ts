export class Disposable {
  constructor(private readonly fn: () => void = () => undefined) {}
  dispose(): void {
    this.fn();
  }
}

export const commands = {
  executeCommand: async () => undefined
};

export const window = {
  showWarningMessage: async () => undefined,
  createOutputChannel: () => ({
    appendLine: () => undefined,
    show: () => undefined,
    clear: () => undefined
  }),
  activeTextEditor: undefined
};

export const workspace = {
  workspaceFolders: []
};
