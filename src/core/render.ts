import { resolveVariableExpression, type VariableResolution } from "./vht/variableExpression";

export function resolveRenderExpression(
    expression: string,
    assign: Record<string, unknown>
): VariableResolution {
    return resolveVariableExpression(expression.trim(), assign);
}

export function render<T>(assign: Record<string, unknown> = {}, temp: T): T {
    return renderValue(assign, temp);
}

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

function renderString(assign: Record<string, unknown>, input: string): string {
    return input.replace(/\{\{(.+?)\}\}/g, (_match, expression: string) => {
        const resolved = resolveRenderExpression(expression, assign);
        return resolved.kind === "resolved" ? String(resolved.value) : "";
    });
}
