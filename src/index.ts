/**
 * CyberHawk Veeam MCP — entry point.
 *
 * A full-operator Model Context Protocol server for Veeam Backup & Replication. Speaks the
 * VBR Public REST API v1 so an MCP client (Claude Code / Desktop, VS Code, etc.) can read AND
 * control jobs, sessions, backups, restores, infrastructure, and malware detection.
 *
 * Built by Rudra Verma | Senior Cyber Security Architect & Researcher | CyberHawk Threat Intel
 * Licensed under the Apache License 2.0.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from '@/config';
import { VbrClient } from '@/veeam/VbrClient';
import { registerAllTools } from '@/tools';

async function main(): Promise<void> {
    const config = loadConfig();
    const client = new VbrClient(config);

    const server = new McpServer({
        name: 'cyberhawk-veeam-mcp',
        version: '1.0.0',
    });

    registerAllTools(server, client);

    const transport = new StdioServerTransport();
    await server.connect(transport);

    // Stderr only — stdout is the MCP JSON-RPC channel and must stay clean.
    console.error(
        `[cyberhawk-veeam-mcp] connected to ${config.baseURL} ` +
            `(read-only=${config.VEEAM_READONLY}). Awaiting MCP client.`,
    );
}

main().catch((error) => {
    console.error('[cyberhawk-veeam-mcp] fatal:', error instanceof Error ? error.message : error);
    process.exit(1);
});
