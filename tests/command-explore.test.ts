import { beforeEach, describe, expect, it, vi } from "vitest";

const vscodeMocks = vi.hoisted(() => ({
  registerCommandMock: vi.fn(),
  executeCommandMock: vi.fn(),
  showInputBoxMock: vi.fn(),
  showWarningMessageMock: vi.fn()
}));

vi.mock("vscode", () => {
  class Disposable {
    constructor(private readonly fn: () => void = () => undefined) {}
    dispose(): void {
      this.fn();
    }
  }

  class Uri {
    constructor(
      public readonly scheme: string,
      public readonly authority: string,
      public readonly path: string
    ) {}

    static from(parts: { scheme: string; authority?: string; path: string }): Uri {
      return new Uri(parts.scheme, parts.authority ?? "", parts.path);
    }

    with(parts: { path?: string }): Uri {
      return new Uri(this.scheme, this.authority, parts.path ?? this.path);
    }
  }

  return {
    Disposable,
    Uri,
    commands: {
      registerCommand: vscodeMocks.registerCommandMock,
      executeCommand: vscodeMocks.executeCommandMock
    },
    window: {
      showInputBox: vscodeMocks.showInputBoxMock,
      showWarningMessage: vscodeMocks.showWarningMessageMock,
      activeTextEditor: undefined
    }
  };
});

const clientMocks = vi.hoisted(() => ({
  sendMock: vi.fn(),
  stopMock: vi.fn()
}));

vi.mock("../src/core/client", () => ({
  send: clientMocks.sendMock,
  stop: clientMocks.stopMock
}));

import * as vscode from "vscode";
import { registerExploreCommands } from "../src/command/explore";
import { collections, virtualFolders } from "../src/core/filesystem/context";

const seedCollections = [
  {
    id: "req_root_status",
    type: "GET",
    name: "status",
    folder: "/",
    url: "http://localhost:9501/status",
    ctime: 1710100000000,
    mtime: 1710107200000,
    headers: {},
    body: "",
    scripts: { pre: "", post: "" }
  },
  {
    id: "req_team_users",
    type: "GET",
    name: "users",
    folder: "/team",
    url: "http://localhost:9501/team/users",
    ctime: 1710300000000,
    mtime: 1710305400000,
    headers: {},
    body: "",
    scripts: { pre: "", post: "" }
  }
];

describe("registerExploreCommands", () => {
  const fsProvider = {
    rename: vi.fn(),
    delete: vi.fn()
  };
  const explorerProvider = {
    refresh: vi.fn()
  };

  beforeEach(() => {
    vscodeMocks.registerCommandMock.mockReset();
    vscodeMocks.executeCommandMock.mockReset();
    vscodeMocks.showInputBoxMock.mockReset();
    vscodeMocks.showWarningMessageMock.mockReset();
    clientMocks.sendMock.mockReset();
    clientMocks.stopMock.mockReset();
    fsProvider.rename.mockReset();
    fsProvider.delete.mockReset();
    explorerProvider.refresh.mockReset();
    collections.length = 0;
    collections.push(...seedCollections.map(item => ({
      ...item,
      headers: { ...item.headers },
      scripts: { ...item.scripts }
    })));
    virtualFolders.clear();
  });

  function getHandler(commandId: string): (...args: unknown[]) => Promise<void> {
    registerExploreCommands("vortex-fs", "request", fsProvider, explorerProvider);
    const call = vscodeMocks.registerCommandMock.mock.calls.find(([id]) => id === commandId);
    if (!call) {
      throw new Error(`Missing command registration: ${commandId}`);
    }
    return call[1];
  }

  it("registers all request workflow commands", () => {
    registerExploreCommands("vortex-fs", "request", fsProvider, explorerProvider);

    expect(vscodeMocks.registerCommandMock.mock.calls.map(([id]) => id)).toEqual([
      "vortex.request.create",
      "vortex.request.rename",
      "vortex.request.delete",
      "vortex.request.send",
      "vortex.request.stop"
    ]);
  });

  it("creates a request file and opens it", async () => {
    vscodeMocks.showInputBoxMock.mockResolvedValue("new-request");
    const create = getHandler("vortex.request.create");

    await create();

    expect(collections.some(item => item.name === "new-request" && item.folder === "/")).toBe(true);
    expect(explorerProvider.refresh).toHaveBeenCalledTimes(1);
    expect(vscodeMocks.executeCommandMock).toHaveBeenCalledWith(
      "vscode.open",
      expect.objectContaining({ path: "/new-request.vht" })
    );
  });

  it("creates a folder when the input ends with a slash", async () => {
    vscodeMocks.showInputBoxMock.mockResolvedValue("archive/");
    const create = getHandler("vortex.request.create");

    await create();

    expect(virtualFolders.has("/archive")).toBe(true);
    expect(vscodeMocks.executeCommandMock).not.toHaveBeenCalled();
  });

  it("renames a request node via the filesystem provider", async () => {
    vscodeMocks.showInputBoxMock.mockResolvedValue("members");
    fsProvider.rename.mockImplementation((oldUri, newUri) => {
      const item = collections.find(entry => entry.name === "users" && entry.folder === "/team");
      if (item) {
        item.name = "members";
        item.folder = "/team";
      }
      return { oldUri, newUri };
    });
    const rename = getHandler("vortex.request.rename");

    await rename({
      resourceUri: vscode.Uri.from({ scheme: "vortex-fs", authority: "request", path: "/team/users.vht" })
    });

    expect(fsProvider.rename).toHaveBeenCalled();
    expect(collections.some(item => item.name === "members" && item.folder === "/team")).toBe(true);
    expect(vscodeMocks.executeCommandMock).toHaveBeenCalledWith(
      "vscode.open",
      expect.objectContaining({ path: "/team/members.vht" })
    );
  });

  it("deletes a node after confirmation", async () => {
    vscodeMocks.showWarningMessageMock.mockResolvedValue("Delete");
    const remove = getHandler("vortex.request.delete");

    await remove({
      resourceUri: vscode.Uri.from({ scheme: "vortex-fs", authority: "request", path: "/team" })
    });

    expect(fsProvider.delete).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/team" }),
      { recursive: true }
    );
  });

  it("sends the selected request payload", async () => {
    const sendCommand = getHandler("vortex.request.send");

    await sendCommand({
      resourceUri: vscode.Uri.from({ scheme: "vortex-fs", authority: "request", path: "/team/users.vht" })
    });

    expect(clientMocks.sendMock).toHaveBeenCalledWith(expect.objectContaining({
      id: "req_team_users",
      name: "users"
    }));
  });

  it("stops the selected request by id", async () => {
    const stopCommand = getHandler("vortex.request.stop");

    await stopCommand({
      resourceUri: vscode.Uri.from({ scheme: "vortex-fs", authority: "request", path: "/team/users.vht" })
    });

    expect(clientMocks.stopMock).toHaveBeenCalledWith("req_team_users");
  });
});
