export async function runHookStrict(code:string, scope:Record<string,any> = {}) {
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    
    // 提取对象的所有键作为参数名，值作为参数值
    const keys = Object.keys(scope);
    const values = Object.values(scope);
    
    const fn = new AsyncFunction(...keys, code);
    return await fn(...values);
}
