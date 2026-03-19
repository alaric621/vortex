import { describe, expect, it } from "vitest";
import { runHookStrict } from "../src/core/runHook";

describe("hook 脚本执行", () => {
  it("应该通过 scope 注入变量并返回执行结果", async () => {
    const result = await runHookStrict(
      "return `${name}:${client.token}:${env}`;",
      {
        name: "demo-user",
        client: {
          token: "demo-token"
        },
        env: "dev"
      }
    );

    expect(result).toBe("demo-user:demo-token:dev");
  });

  it("应该允许 hook 修改传入的对象", async () => {
    const request = {
      headers: {} as Record<string, string>
    };
    const response = {
      events: [] as string[]
    };

    await runHookStrict(
      "request.headers.Authorization = `Bearer ${token}`; response.events.push('done');",
      {
        request,
        response,
        token: "demo-token"
      }
    );

    expect(request.headers).toEqual({
      Authorization: "Bearer demo-token"
    });
    expect(response.events).toEqual(["done"]);
  });

  it("应该支持异步 hook 逻辑", async () => {
    const result = await runHookStrict(
      "await Promise.resolve(); return value + 1;",
      {
        value: 1
      }
    );

    expect(result).toBe(2);
  });

  it("应该在未传入 scope 时正常执行", async () => {
    const result = await runHookStrict("return 'ok';");

    expect(result).toBe("ok");
  });

  it("应该在脚本抛错时向外抛出异常", async () => {
    await expect(
      runHookStrict("throw new Error('hook failed');", {
        value: 1
      })
    ).rejects.toThrow("hook failed");
  });
});
