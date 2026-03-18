import { describe, expect, it } from "vitest";
import {
  parseVhtToJson,
  parserJsonToVht,
  paserJsonToVht,
  transform
} from "../src/core/paser";

describe("VHT parser", () => {
  it("should parse request line, headers, body and scripts", () => {
    const text = [
      "WS localhost:9501",
      "Upgrade: websocket",
      "Connection: Upgrade",
      "",
      "{",
      "  \"action\": \"subscribe\"",
      "}",
      "",
      ">>>",
      "console.log('pre');",
      "",
      "<<<",
      "console.log('post');"
    ].join("\n");

    const parsed = parseVhtToJson(text);
    expect(parsed.type).toBe("WS");
    expect(parsed.url).toBe("localhost:9501");
    expect(parsed.headers).toEqual({
      Upgrade: "websocket",
      Connection: "Upgrade"
    });
    expect(parsed.body).toBe("{\n  \"action\": \"subscribe\"\n}");
    expect(parsed.scripts).toEqual({
      pre: "console.log('pre');",
      post: "console.log('post');"
    });
  });

  it("should parse post script when only <<< marker exists", () => {
    const text = [
      "GET http://localhost:3000/status",
      "Accept: */*",
      "",
      "<<<",
      "console.log('only post');"
    ].join("\n");

    const parsed = parseVhtToJson(text);
    expect(parsed.scripts).toEqual({
      pre: "",
      post: "console.log('only post');"
    });
  });

  it("should throw when request line is missing", () => {
    expect(() => parseVhtToJson("")).toThrow("request line is required");
  });

  it("should throw when header line is malformed", () => {
    const text = [
      "GET http://localhost:3000/status",
      "Authorization Bearer token"
    ].join("\n");

    expect(() => parseVhtToJson(text)).toThrow("malformed header line");
  });

  it("should throw when marker order is invalid", () => {
    const text = [
      "GET http://localhost:3000/status",
      "",
      "<<<",
      "console.log('post');",
      ">>>",
      "console.log('pre');"
    ].join("\n");

    expect(() => parseVhtToJson(text)).toThrow(">>> marker must appear before <<< marker");
  });

  it("should roundtrip from json to vht and back", () => {
    const request = {
      type: "get",
      url: "http://localhost:3000/ping",
      headers: {
        Authorization: "Bearer {{token}}"
      },
      body: "{\"a\":1}",
      scripts: {
        pre: "console.log('pre');",
        post: "console.log('post');"
      }
    };

    const text = parserJsonToVht(request);
    const parsed = parseVhtToJson(text);

    expect(parsed).toEqual({
      type: "GET",
      url: "http://localhost:3000/ping",
      headers: {
        Authorization: "Bearer {{token}}"
      },
      body: "{\"a\":1}",
      scripts: {
        pre: "console.log('pre');",
        post: "console.log('post');"
      }
    });
  });

  it("should keep old paserJsonToVht alias compatible", () => {
    const request = {
      type: "GET",
      url: "http://localhost:3000/status"
    };

    expect(paserJsonToVht(request)).toBe(parserJsonToVht(request));
  });

  it("transform should return ast structure", () => {
    const ast = transform("GET http://localhost:3000/status\nAccept: */*\n");
    expect(ast.method).toBe("GET");
    expect(ast.url).toBe("http://localhost:3000/status");
    expect(ast.headers).toEqual({ Accept: "*/*" });
    expect(ast.body).toBe("");
    expect(ast.scripts).toEqual({ pre: "", post: "" });
  });
});
