import { beforeEach, describe, expect, it, vi } from "vitest";

const vscodeMocks = vi.hoisted(() => {
  const channel = {
    appendLine: vi.fn(),
    show: vi.fn()
  };

  return {
    channel,
    createOutputChannel: vi.fn(() => channel),
    showInformationMessage: vi.fn(() => Promise.resolve(undefined))
  };
});

vi.mock("vscode", () => ({
  window: {
    createOutputChannel: vscodeMocks.createOutputChannel,
    showInformationMessage: vscodeMocks.showInformationMessage
  }
}));

describe("client placeholder", () => {
  beforeEach(() => {
    vscodeMocks.channel.appendLine.mockReset();
    vscodeMocks.channel.show.mockReset();
    vscodeMocks.createOutputChannel.mockClear();
    vscodeMocks.showInformationMessage.mockClear();
    vi.resetModules();
  });

  it("logs a clear placeholder message when sending", async () => {
    const client = await import("../src/core/client");

    await client.send({
      id: "req_demo",
      name: "demo",
      type: "POST",
      url: "https://example.com"
    });

    expect(vscodeMocks.createOutputChannel).toHaveBeenCalledWith("Vortex Client");
    expect(vscodeMocks.channel.appendLine).toHaveBeenCalledWith(
      "[placeholder] send not implemented: POST demo -> https://example.com"
    );
    expect(vscodeMocks.channel.show).toHaveBeenCalledWith(true);
    expect(vscodeMocks.showInformationMessage).toHaveBeenCalledWith(
      "Vortex client is still a placeholder. Send is not implemented for demo."
    );
  });

  it("logs a clear placeholder message when stopping", async () => {
    const client = await import("../src/core/client");

    await client.stop("req_demo");

    expect(vscodeMocks.createOutputChannel).toHaveBeenCalledWith("Vortex Client");
    expect(vscodeMocks.channel.appendLine).toHaveBeenCalledWith(
      "[placeholder] stop not implemented: req_demo"
    );
    expect(vscodeMocks.channel.show).toHaveBeenCalledWith(true);
    expect(vscodeMocks.showInformationMessage).toHaveBeenCalledWith(
      "Vortex client is still a placeholder. Stop is not implemented for req_demo."
    );
  });
});
