/**
 * CyberHawk Veeam MCP — MCP tool result helpers.
 *
 * Built by Rudra Verma | Senior Cyber Security Architect & Researcher | CyberHawk Threat Intel
 * Licensed under the Apache License 2.0.
 */

export interface ToolResult {
    content: { type: 'text'; text: string }[];
    isError?: boolean;
    // The MCP SDK's CallToolResult carries an open index signature; matching it here keeps
    // handler return types assignable without casting.
    [key: string]: unknown;
}

/** Wrap any JSON-serialisable value as a text tool result. */
export function jsonResult(data: unknown): ToolResult {
    const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    return { content: [{ type: 'text', text }] };
}

/** Wrap a thrown error as a tool result so the model sees the reason instead of a crash. */
export function errorResult(error: unknown): ToolResult {
    const message = error instanceof Error ? error.message : String(error);
    return { content: [{ type: 'text', text: `ERROR: ${message}` }], isError: true };
}

/**
 * Run a tool body and normalise success/failure into a ToolResult. Keeps every handler a
 * one-liner and guarantees a Veeam API failure surfaces as a readable message.
 */
export async function runTool(fn: () => Promise<unknown>): Promise<ToolResult> {
    try {
        return jsonResult(await fn());
    } catch (error) {
        return errorResult(error);
    }
}
