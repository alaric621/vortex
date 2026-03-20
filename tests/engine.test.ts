import { describe, expect, it } from "vitest";
import { Converter, Parser, collectDiagnosticIssues, resolveVariableExpression } from "../src/core/vht/engine";

describe("VHT 引擎", () => {
  it("解析请求并转换为 JSON", () => {
    const parser = new Parser();
    const converter = new Converter();
    const ast = parser.parse("GET http://localhost\nContent-Type: application/json\n\n{}");

    const json = converter.astToJson(ast);
    expect(json.type).toBe("GET");
    expect(json.url).toBe("http://localhost");
    expect(json.headers["Content-Type"]).toBe("application/json");
    expect(json.body).toBe("{}");
  });

  it("收集变量诊断问题", () => {
    const parser = new Parser();
    const ast = parser.parse("GET http://localhost\nAuthorization: Bearer {{missing}}");
    const issues = collectDiagnosticIssues(ast, "GET http://localhost\nAuthorization: Bearer {{missing}}", {
      token: "ok"
    });

    expect(issues.some(issue => issue.code === "unknown-variable-path")).toBe(true);
  });

  it("解析变量表达式", () => {
    const result = resolveVariableExpression("client.token", {
      client: { token: "demo" }
    });

    expect(result.kind).toBe("resolved");
    if (result.kind === "resolved") {
      expect(result.value).toBe("demo");
    }
  });

  it("从 JSON 生成 VHT 文本", () => {
    const converter = new Converter();
    const text = converter.jsonToVht({
      type: "POST",
      url: "https://example.com",
      headers: {
        "Content-Type": "application/json",
        "Authorization":"{{name}}"
      },
      body: "{\"ok\":true}",
      scripts: {
        pre: "console.log('pre')",
        post: "console.log('post')"
      }
    });

    expect(text).toContain("POST https://example.com");
    expect(text).toContain("Content-Type: application/json");
    expect(text).toContain(">>>");
    expect(text).toContain("<<<");
  });

  it("生成包含区块与变量的完整 AST", () => {
    const parser = new Parser();
    const text = [
      "GET http://localhost",
      "Authorization: Bearer {{client.token}}",
      "",
      "{\"ok\":\"{{client.toke}}\"}",
      ">>>",
      "console.log('pre')",
      "",
      "<<<",
      "console.log('post')"
    ].join("\n");

    const ast = parser.parse(text);
    
    expect(ast.sections.request?.type).toBe("RequestLine");
    expect(ast.sections.headers.length).toBe(1);
    expect(ast.sections.body?.type).toBe("Body");
    expect(ast.sections.scripts.pre?.type).toBe("PreScript");
    expect(ast.sections.scripts.post?.type).toBe("PostScript");
    expect(ast.variables.length).toBe(2);
    expect(ast.variables[0]?.expression).toBe("client.token");
  });
});
