import { beforeEach, describe, expect, it, vi } from "vitest";

const vscodeMock = vi.hoisted(() => ({
  executeCommand: vi.fn()
}));

vi.mock("vscode", () => {
  class Position {
    constructor(public readonly line: number, public readonly character: number) {}
  }

  class Range {
    public readonly start: Position;
    public readonly end: Position;

    constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number) {
      this.start = new Position(startLine, startCharacter);
      this.end = new Position(endLine, endCharacter);
    }
  }

  class CompletionItem {
    public range?: Range;
    public detail?: string;
    public insertText?: string;
    constructor(public readonly label: string, public readonly kind: number) {}
  }

  const CompletionItemKind = {
    Property: 0
  };

  class Uri {
    constructor(
      public readonly scheme: string,
      public readonly authority: string,
      public readonly path: string
    ) {}

    static from(parts: { scheme: string; authority?: string; path: string }): Uri {
      return new Uri(parts.scheme, parts.authority ?? "", parts.path);
    }
  }

  return {
    Position,
    Range,
    CompletionItem,
    CompletionItemKind,
    Uri,
    commands: {
      executeCommand: vscodeMock.executeCommand
    },
    window: {
      showWarningMessage: vi.fn(),
      activeTextEditor: undefined,
      createOutputChannel: vi.fn(() => ({
        appendLine: vi.fn(),
        show: vi.fn(),
        clear: vi.fn()
      }))
    }
  };
});

const mockVariables = {
  token: "demo-token",
  user: {
    name: "vortex",
    profile: { id: 42 }
  }
};

vi.mock("../src/context", () => ({
  getVhtVariables: vi.fn(() => mockVariables)
}));

import * as vscode from "vscode";
import { getVariableCompletions } from "../src/core/vht/completion/variable";
import type { VhtAST } from "../src/core/vht/parser/types";
import { getVhtVariables } from "../src/context";

class FakeDocument {
  constructor(public readonly uri: vscode.Uri, private readonly lines: string[]) {}
  lineAt(line: number): { text: string } {
    return { text: this.lines[line] ?? "" };
  }
}

function createVariable(line: number, text: string) {
  return {
    expression: text,
    raw: text,
    range: {
      start: { line, character: 0 },
      end: { line, character: text.length }
    }
  };
}

const lines = [
  "{{token}}",
  "{{user.na}}",
  "{{user['n}}",
  "plain text"
];

const ast: VhtAST = {
  nodes: [],
  errors: [],
  sections: {
    headers: [],
    scripts: {}
  },
  variables: [
    createVariable(0, lines[0]),
    createVariable(1, lines[1]),
    createVariable(2, lines[2])
  ]
};

const document = new FakeDocument(vscode.Uri.from({ scheme: "vortex-fs", path: "/demo" }), lines) as unknown as vscode.TextDocument;

describe("variableCompletion", () => {
  beforeEach(() => {
    vi.mocked(getVhtVariables).mockClear();
    vscodeMock.executeCommand.mockClear();
  });

  it("returns empty when the cursor is outside of a variable", () => {
    const result = getVariableCompletions(document, new vscode.Position(3, 1), ast);
    expect(result).toEqual([]);
  });

  it("provides root variable suggestions for simple prefixes", () => {
    const result = getVariableCompletions(document, new vscode.Position(0, 5), ast);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(item => item.label === "token")).toBe(true);
    expect(vi.mocked(getVhtVariables)).toHaveBeenCalledWith(document.uri);
  });

  it("provides dot-property suggestions when typing after a dot", () => {
    const suggestions = getVariableCompletions(document, new vscode.Position(1, 9), ast);
    const target = suggestions.find(item => item.label === "name");
    expect(target).toBeDefined();
    expect(target?.insertText).toBe("name");
  });

  it("provides bracket-key suggestions when inside bracket expressions", () => {
    const completions = getVariableCompletions(document, new vscode.Position(2, 9), ast);
    const bracketSuggestion = completions.find(item => item.label === "name");
    expect(bracketSuggestion).toBeDefined();
    expect(bracketSuggestion?.insertText).toBe("name']");
  });
});
