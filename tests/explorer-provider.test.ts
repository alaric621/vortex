import { beforeEach, describe, expect, it, vi } from "vitest";

const vscodeState = vi.hoisted(() => ({
  readDirectoryMock: vi.fn()
}));

vi.mock("vscode", () => {
  class EventEmitter<T> {
    public event = vi.fn();
    public fire = vi.fn<(value?: T) => void>();
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

    static joinPath(base: Uri, ...segments: string[]): Uri {
      const path = [base.path, ...segments].join("/").replace(/\/{2,}/g, "/");
      return new Uri(base.scheme, base.authority, path);
    }

    with(parts: { path?: string }): Uri {
      return new Uri(this.scheme, this.authority, parts.path ?? this.path);
    }
  }

  class TreeItem {
    public contextValue?: string;
    public resourceUri?: Uri;
    public command?: { command: string; title: string; arguments?: unknown[] };
    public tooltip?: string;
    public iconPath?: unknown;

    constructor(
      public readonly label: string,
      public readonly collapsibleState: number
    ) {}
  }

  class ThemeIcon {
    constructor(public readonly id: string) {}
  }

  return {
    EventEmitter,
    Uri,
    TreeItem,
    ThemeIcon,
    TreeItemCollapsibleState: {
      None: 0,
      Collapsed: 1
    },
    FileType: {
      File: 1,
      Directory: 2
    },
    workspace: {
      fs: {
        readDirectory: vscodeState.readDirectoryMock
      }
    }
  };
});

const clientMocks = vi.hoisted(() => ({
  isRequestRunningMock: vi.fn((id: string) => id === "req_team_users")
}));

vi.mock("../src/core/client", () => ({
  isRequestRunning: clientMocks.isRequestRunningMock
}));

import { ExplorerProvider } from "../src/views/explore";
import { collections, virtualFolders } from "../src/core/filesystem/store";

describe("ExplorerProvider", () => {
  beforeEach(() => {
    vscodeState.readDirectoryMock.mockReset();
    clientMocks.isRequestRunningMock.mockClear();
    collections.length = 0;
    collections.push(
      {
        id: "req_team_users",
        type: "GET",
        name: "users",
        folder: "/team",
        url: "http://localhost/users",
        ctime: 1,
        mtime: 1,
        headers: {},
        body: "",
        scripts: { pre: "", post: "" }
      },
      {
        id: "req_team_jobs",
        type: "GET",
        name: "jobs",
        folder: "/team",
        url: "http://localhost/jobs",
        ctime: 1,
        mtime: 1,
        headers: {},
        body: "",
        scripts: { pre: "", post: "" }
      }
    );
    virtualFolders.clear();
  });

  it("marks only the running request node as running", async () => {
    vscodeState.readDirectoryMock.mockResolvedValue([
      ["jobs", 1],
      ["users", 1]
    ]);
    const provider = new ExplorerProvider("vortex-fs", "request");

    const items = await provider.getChildren({
      resourceUri: {
        scheme: "vortex-fs",
        authority: "request",
        path: "/team"
      } as any
    } as any);

    const users = items.find(item => item.label === "users");
    const jobs = items.find(item => item.label === "jobs");

    expect(users?.contextValue).toBe("vortex.requestNode.running");
    expect(jobs?.contextValue).toBe("vortex.requestNode.idle");
  });
});
