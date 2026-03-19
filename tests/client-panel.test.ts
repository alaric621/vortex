import { beforeEach, describe, expect, it, vi } from "vitest";

const vscodeState = vi.hoisted(() => {
  const view = {
    webview: {
      html: "",
      options: {}
    },
    show: vi.fn(),
    onDidDispose: vi.fn()
  };

  return {
    view,
    executeCommand: vi.fn(() => Promise.resolve(undefined))
  };
});

vi.mock("vscode", () => ({
  commands: {
    executeCommand: vscodeState.executeCommand
  },
  window: {}
}));

describe("client panel", () => {
  beforeEach(() => {
    vscodeState.view.webview.html = "";
    vscodeState.view.show.mockReset();
    vscodeState.view.onDidDispose.mockReset();
    vscodeState.executeCommand.mockClear();
    vi.resetModules();
  });

  it("renders highlighted log lines in the panel view", async () => {
    const { getClientPanel, getClientPanelViewProvider } = await import("../src/views/clientPanel");
    const provider = getClientPanelViewProvider() as any;
    provider.resolveWebviewView(vscodeState.view);
    const panel = getClientPanel();

    panel.appendLine("[send] GET hello");
    panel.appendLine("status: 200 OK");
    panel.appendLine("duration: 42 ms");
    panel.appendLine("[error] GET hello: failed");
    panel.show();

    expect(vscodeState.view.webview.html).toContain('class="entry-toggle"');
    expect(vscodeState.view.webview.html).toContain('class="entry-title">[send] GET hello');
    expect(vscodeState.view.webview.html).toContain('class="entry-meta">duration: 42 ms  [error] GET hello: failed');
    expect(vscodeState.view.webview.html).toContain('class="line status">status: 200 OK');
    expect(vscodeState.view.webview.html).toContain('class="entry-body"');
    expect(vscodeState.view.webview.html).toContain(">Copy<");
    expect(vscodeState.executeCommand).toHaveBeenCalledWith("workbench.view.extension.vortex-panel");
    expect(vscodeState.view.show).toHaveBeenCalled();
  });
});
