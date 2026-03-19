import { beforeEach, describe, expect, it, vi } from "vitest";

const vscodeState = vi.hoisted(() => {
  const outputChannel = {
    appendLine: vi.fn(),
    show: vi.fn(),
    clear: vi.fn()
  };

  return {
    outputChannel,
    createOutputChannel: vi.fn(() => outputChannel)
  };
});

vi.mock("vscode", () => ({
  window: {
    createOutputChannel: vscodeState.createOutputChannel
  }
}));

describe("client output channel", () => {
  beforeEach(() => {
    vscodeState.outputChannel.appendLine.mockReset();
    vscodeState.outputChannel.show.mockReset();
    vscodeState.outputChannel.clear.mockReset();
    vscodeState.createOutputChannel.mockClear();
    vi.resetModules();
  });

  it("uses the native vscode output channel as a singleton", async () => {
    const { getClientPanel } = await import("../src/views/clientPanel.js");
    const first = getClientPanel();
    const second = getClientPanel();

    first.appendLine("[send] GET hello");
    first.show(true);
    first.clear();

    expect(first).toBe(second);
    expect(vscodeState.createOutputChannel).toHaveBeenCalledTimes(1);
    expect(vscodeState.createOutputChannel).toHaveBeenCalledWith("Vortex", "vortex-log");
    expect(vscodeState.outputChannel.appendLine).toHaveBeenCalledWith("[send] GET hello");
    expect(vscodeState.outputChannel.show).toHaveBeenCalledWith(true);
    expect(vscodeState.outputChannel.clear).toHaveBeenCalledTimes(1);
  });
});
