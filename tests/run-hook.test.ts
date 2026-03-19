import { describe, expect, it } from "vitest";
import { resolveHookRequest, runHook } from "../src/core/runHook";

describe("runHook", () => {
  it("resolves templates in request fields", () => {
    const request = resolveHookRequest({
      id: "req_hook",
      url: "https://example.com/{{name}}",
      headers: {
        Authorization: "Bearer {{client.token}}"
      },
      body: "{\"env\":\"{{env}}\"}",
      scripts: {
        pre: "console.log('{{name}}')",
        post: ""
      }
    });

    expect(request.url).toBe("https://example.com/demo-user");
    expect(request.headers).toEqual({ Authorization: "Bearer demo-token" });
    expect(request.body).toBe("{\"env\":\"dev\"}");
    expect(request.scripts?.pre).toBe("console.log('demo-user')");
  });

  it("does not execute arbitrary expressions while resolving templates", () => {
    const request = resolveHookRequest({
      id: "req_hook",
      url: "https://example.com/{{client.token.toUpperCase()}}",
      body: "{{client['token']}}|{{client.token}}"
    });

    expect(request.url).toBe("https://example.com/");
    expect(request.body).toBe("demo-token|demo-token");
  });

  it("executes hook scripts against mutable request and response objects", async () => {
    const messages: string[] = [];
    const context = {
      request: {
        id: "req_hook",
        headers: {}
      },
      response: {
        events: [] as string[]
      },
      variables: {
        value: "token"
      },
      log: (message: string) => messages.push(message)
    };

    await runHook(
      "request.headers.Authorization = `Bearer ${variables.value}`; console.log('pre-ready');",
      context
    );
    await runHook(
      "response.events.push('done'); console.log(response.events.length);",
      context
    );

    expect(context.request.headers).toEqual({ Authorization: "Bearer token" });
    expect(context.response.events).toEqual(["done"]);
    expect(messages).toEqual(["pre-ready", "1"]);
  });
});
