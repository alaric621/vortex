import { describe, expect, it } from "vitest";
import grammar from "../syntaxes/vortex-log.tmLanguage.json";

function getRepoPattern(key: string, index = 0): { begin?: string; end?: string; match?: string; include?: string } {
  const repo = (grammar as unknown as { repository: Record<string, { patterns: Array<{ begin?: string; end?: string; match?: string; include?: string }> }> }).repository;
  return repo[key].patterns[index];
}

describe("vortex log grammar", () => {
  it("registers json/html body blocks in root patterns", () => {
    const rootPatterns = (grammar as unknown as { patterns: Array<{ include?: string }> }).patterns;
    expect(rootPatterns.some(pattern => pattern.include === "#json-body")).toBe(true);
    expect(rootPatterns.some(pattern => pattern.include === "#html-body")).toBe(true);
  });

  it("matches JSON body starts but excludes timestamp lines", () => {
    const jsonPattern = getRepoPattern("json-body", 0);
    const begin = new RegExp(jsonPattern.begin ?? "");

    expect(begin.test("{")).toBe(true);
    expect(begin.test("  {")).toBe(true);
    expect(begin.test("[")).toBe(true);
    expect(begin.test(" [")).toBe(true);
    expect(begin.test("[12:04:13.051] {\"id\":2}")).toBe(false);
  });

  it("matches HTML body starts", () => {
    const htmlPattern = getRepoPattern("html-body", 0);
    const begin = new RegExp(htmlPattern.begin ?? "", "i");

    expect(begin.test("<!doctype html>")).toBe(true);
    expect(begin.test("<html>")).toBe(true);
    expect(begin.test("<body>")).toBe(true);
    expect(begin.test("<div>hello</div>")).toBe(true);
    expect(begin.test("{\"ok\":true}")).toBe(false);
  });

  it("keeps request line and key fields highlighted", () => {
    const keyRepo = (grammar as unknown as { repository: Record<string, { patterns: Array<{ match?: string }> }> }).repository["key-value"].patterns;
    const requestLine = new RegExp(keyRepo.find(pattern => pattern.match?.startsWith("^(GET|POST|PUT"))?.match ?? "");
    const fieldLine = new RegExp(keyRepo.find(pattern => pattern.match === "^content-type:\\s+")?.match ?? "");

    expect(requestLine.test("GET https://example.com HTTP/1.1")).toBe(true);
    expect(requestLine.test("WEBSOCKET ws://example.test/socket HTTP/1.1")).toBe(true);
    expect(fieldLine.test("content-type: text/html; charset=utf-8")).toBe(true);
  });
});
