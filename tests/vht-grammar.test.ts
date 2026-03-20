import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import grammar from "../syntaxes/vht.tmLanguage.json";

type RepoEntry = {
  begin?: string;
  end?: string;
  match?: string;
  include?: string;
  patterns?: RepoEntry[];
};

function getRepo(key: string): RepoEntry {
  const repository = (grammar as unknown as { repository: Record<string, RepoEntry> }).repository;
  return repository[key];
}

function parseLooseJson(input: string): unknown {
  // language-configuration files are commonly JSONC-style; normalize trailing commas for test parsing.
  return JSON.parse(input.replace(/,\s*([}\]])/g, "$1"));
}

function loadLanguageConfig(): {
  comments?: { lineComment?: { comment?: string } };
  brackets?: string[][];
  surroundingPairs?: string[][];
  autoClosingPairs?: Array<{ open: string; close: string }>;
} {
  const filePath = path.join(process.cwd(), "syntaxes", "vht.language-configuration.json");
  return parseLooseJson(fs.readFileSync(filePath, "utf8")) as {
    comments?: { lineComment?: { comment?: string } };
    brackets?: string[][];
    surroundingPairs?: string[][];
    autoClosingPairs?: Array<{ open: string; close: string }>;
  };
}

describe("vht grammar", () => {
  it("registers request/body/interceptor blocks in root patterns", () => {
    const rootPatterns = (grammar as unknown as { patterns: Array<{ include?: string }> }).patterns;
    expect(rootPatterns.some(pattern => pattern.include === "#request")).toBe(true);
    expect(rootPatterns.some(pattern => pattern.include === "#json-body-container")).toBe(true);
    expect(rootPatterns.some(pattern => pattern.include === "#interceptor-pre")).toBe(true);
    expect(rootPatterns.some(pattern => pattern.include === "#interceptor-post")).toBe(true);
  });

  it("ensures json body container reuses JS expressions and JSON", () => {
    const container = getRepo("json-body-container");
    const includes = (container.patterns ?? []).map(pattern => pattern.include);
    expect(includes).toEqual(expect.arrayContaining(["#js-expression", "source.json"]));
  });

  it("marks header keys and values with dedicated scopes", () => {
    const header = getRepo("header-line");
    expect(header.patterns?.some(pattern => pattern.name === "constant.language.header.key")).toBe(true);
    expect(header.patterns?.some(pattern => pattern.name === "string.unquoted.header.value")).toBe(true);
  });

  it("matches supported request line methods", () => {
    const request = getRepo("request");
    const begin = new RegExp(request.begin ?? "");

    expect(begin.test("GET https://example.com")).toBe(true);
    expect(begin.test("POST https://example.com")).toBe(true);
    expect(begin.test("CONNECT https://example.com")).toBe(true);
    expect(begin.test("TRACE https://example.com")).toBe(true);
    expect(begin.test("WEBSOCKET wss://example.com/socket")).toBe(true);
    expect(begin.test("SSE https://example.com/events")).toBe(true);
    expect(begin.test("EVENTSOURCE https://example.com/events")).toBe(true);
    expect(begin.test("SUBSCRIBE https://example.com/topic")).toBe(true);
    expect(begin.test("UNSUBSCRIBE https://example.com/topic")).toBe(true);
    expect(begin.test("FETCH https://example.com")).toBe(false);
  });

  it("captures URL variants and HTTP version in request line patterns", () => {
    const requestPatterns = getRepo("request").patterns ?? [];
    const absoluteWithVersion = new RegExp(requestPatterns[0]?.match ?? "");
    const relativeWithVersion = new RegExp(requestPatterns[2]?.match ?? "");

    expect(absoluteWithVersion.test("GET https://api.example.com:8443/users?id=1 HTTP/1.1")).toBe(true);
    expect(relativeWithVersion.test("GET /users/42 HTTP/2")).toBe(true);
  });

  it("matches header lines and variable expressions", () => {
    const header = getRepo("header-line");
    const jsExpression = getRepo("js-expression");
    const headerBegin = new RegExp(header.begin ?? "");
    const exprBegin = new RegExp(jsExpression.begin ?? "");
    const exprEnd = new RegExp(jsExpression.end ?? "");

    expect(headerBegin.test("Content-Type: application/json")).toBe(true);
    expect(headerBegin.test("{{token}}: abc")).toBe(true);
    expect(headerBegin.test("NoColonHere")).toBe(false);

    expect(exprBegin.test("{{value")).toBe(true);
    expect(exprEnd.test("value}}")).toBe(true);
  });

  it("recognizes interceptor delimiters", () => {
    const pre = getRepo("interceptor-pre");
    const post = getRepo("interceptor-post");
    const preBegin = new RegExp(pre.begin ?? "");
    const postBegin = new RegExp(post.begin ?? "");

    expect(preBegin.test(">>>")).toBe(true);
    expect(postBegin.test("<<<")).toBe(true);
    expect(preBegin.test(">>")).toBe(false);
    expect(postBegin.test("<<")).toBe(false);
  });
});

describe("vht language configuration", () => {
  it("defines line comments and bracket pairs for variable delimiters", () => {
    const config = loadLanguageConfig();
    const comments = config.comments;
    const brackets = config.brackets ?? [];
    const surroundingPairs = config.surroundingPairs ?? [];

    expect(comments?.lineComment?.comment).toBe("#");
    expect(brackets.some(pair => pair[0] === "{{" && pair[1] === "}}")).toBe(true);
    expect(surroundingPairs.some(pair => pair[0] === "{{" && pair[1] === "}}")).toBe(true);
  });

  it("keeps auto closing pairs for quotes and brackets", () => {
    const autoClosingPairs = loadLanguageConfig().autoClosingPairs ?? [];

    expect(autoClosingPairs.some(pair => pair.open === "{" && pair.close === "}")).toBe(true);
    expect(autoClosingPairs.some(pair => pair.open === "[" && pair.close === "]")).toBe(true);
    expect(autoClosingPairs.some(pair => pair.open === "(" && pair.close === ")")).toBe(true);
    expect(autoClosingPairs.some(pair => pair.open === "\"" && pair.close === "\"")).toBe(true);
    expect(autoClosingPairs.some(pair => pair.open === "'" && pair.close === "'")).toBe(true);
  });
});
