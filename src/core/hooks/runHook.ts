type HookScope = Record<string, unknown>;
type HookFunction = (...args: unknown[]) => Promise<unknown>;
type AsyncFunctionConstructor = new (...args: string[]) => HookFunction;

export interface HookCompiler {
  create(...args: string[]): HookFunction;
}

/**
 * Small wrapper around dynamic hook execution so callers do not depend on
 * `AsyncFunction` directly and tests can swap the compiler when needed.
 */
export class HookExecutor {
  constructor(private readonly compiler: HookCompiler = createDefaultHookCompiler()) {}

  /**
   * 方法：execute
   * 说明：执行 execute 相关处理逻辑。
   * @param code 参数 code。
   * @param scope 参数 scope。
   * @returns 异步返回 unknown 类型结果。
   * 返回值示例：const result = await execute('demo-value', { ... }); // { ok: true }
   */
  async execute(code: string, scope: HookScope = {}): Promise<unknown> {
    const { names, values } = getScopeBindings(scope);
    // 变量：hook，用于存储钩子。
    const hook = this.compiler.create(...names, `"use strict";\n${code}`);
    return await hook(...values);
  }
}

// 变量：defaultHookExecutor，用于存储default钩子executor。
const defaultHookExecutor = new HookExecutor();

/**
 * 方法：runHookStrict
 * 说明：执行 runHookStrict 相关处理逻辑。
 * @param code 参数 code。
 * @param scope 参数 scope。
 * @returns 异步返回 unknown 类型结果。
 * 返回值示例：const result = await runHookStrict('demo-value', { ... }); // { ok: true }
 */
export async function runHookStrict(code: string, scope: HookScope = {}): Promise<unknown> {
  return await defaultHookExecutor.execute(code, scope);
}

/**
 * 方法：createDefaultHookCompiler
 * 说明：执行 createDefaultHookCompiler 相关处理逻辑。
 * @param 无 无参数。
 * @returns 返回 HookCompiler 类型结果。
 * 返回值示例：const result = createDefaultHookCompiler(); // { ok: true }
 */
function createDefaultHookCompiler(): HookCompiler {
  // 变量：AsyncFunction，用于存储asyncfunction。
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as AsyncFunctionConstructor;
  return {
    create: (...args: string[]) => new AsyncFunction(...args)
  };
}

/**
 * 方法：getScopeBindings
 * 说明：执行 getScopeBindings 相关处理逻辑。
 * @param scope 参数 scope。
 * @returns 返回 { names: string[]; values: unknown[] } 类型结果。
 * 返回值示例：const result = getScopeBindings({ ... }); // { ok: true }
 */
function getScopeBindings(scope: HookScope): { names: string[]; values: unknown[] } {
  // 变量：names，用于存储names。
  const names: string[] = [];
  // 变量：values，用于存储values。
  const values: unknown[] = [];

  for (const [name, value] of Object.entries(scope)) {
    assertScopeBindingName(name);
    names.push(name);
    values.push(value);
  }

  return { names, values };
}

/**
 * 方法：assertScopeBindingName
 * 说明：执行 assertScopeBindingName 相关处理逻辑。
 * @param name 参数 name。
 * @returns 无返回值，通过副作用完成处理。
 * 返回值示例：assertScopeBindingName('demo-value'); // undefined
 */
function assertScopeBindingName(name: string): void {
  if (/^[A-Za-z_$][\w$]*$/.test(name)) {
    return;
  }

  throw new Error(`Invalid hook scope key: ${name}`);
}
