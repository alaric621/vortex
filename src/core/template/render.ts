import { resolveVariableExpression, type VariableResolution } from "../vht/engine/variableExpression";

/**
 * 方法：resolveRenderExpression
 * 说明：执行 resolveRenderExpression 相关处理逻辑。
 * @param expression 参数 expression。
 * @param assign 参数 assign。
 * @returns 返回 VariableResolution 类型结果。
 * 返回值示例：const result = resolveRenderExpression('demo-value', { token: 'abc' }); // { ok: true }
 */
export function resolveRenderExpression(
    expression: string,
    assign: Record<string, unknown>
): VariableResolution {
    return resolveVariableExpression(expression.trim(), assign);
}

/**
 * 方法：render
 * 说明：执行 render 相关处理逻辑。
 * @param assign 参数 assign。
 * @param temp 参数 temp。
 * @returns 返回 T 类型结果。
 * 返回值示例：const result = render({ token: 'abc' }, { ... }); // { ok: true }
 */
export function render<T>(assign: Record<string, unknown> = {}, temp: T): T {
    return renderValue(assign, temp);
}

/**
 * 方法：renderValue
 * 说明：执行 renderValue 相关处理逻辑。
 * @param assign 参数 assign。
 * @param value 参数 value。
 * @returns 返回 T 类型结果。
 * 返回值示例：const result = renderValue({ token: 'abc' }, { ... }); // { ok: true }
 */
function renderValue<T>(assign: Record<string, unknown>, value: T): T {
    if (typeof value === "string") {
        return renderString(assign, value) as T;
    }

    if (Array.isArray(value)) {
        return value.map(item => renderValue(assign, item)) as T;
    }

    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [
                renderString(assign, key),
                renderValue(assign, item)
            ])
        ) as T;
    }

    return value;
}

/**
 * 方法：renderString
 * 说明：执行 renderString 相关处理逻辑。
 * @param assign 参数 assign。
 * @param input 参数 input。
 * @returns 返回 string 类型结果。
 * 返回值示例：const text = renderString({ token: 'abc' }, 'demo-value'); // 'demo-value'
 */
function renderString(assign: Record<string, unknown>, input: string): string {
    return input.replace(/\{\{(.+?)\}\}/g, (_match, expression: string) => {
        // 变量：resolved，用于存储resolved。
        const resolved = resolveRenderExpression(expression, assign);
        return resolved.kind === "resolved" ? String(resolved.value) : "";
    });
}
