/**
 * CyberHawk Veeam MCP — server discovery + generic escape-hatch tools.
 *
 * Built by Rudra Verma | Senior Cyber Security Architect & Researcher | CyberHawk Threat Intel
 * Licensed under the Apache License 2.0.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { VbrClient } from '@/veeam/VbrClient';
import { runTool } from '@/util/result';

export function registerServerTools(server: McpServer, client: VbrClient): void {
    server.registerTool(
        'veeam_server_info',
        {
            title: 'Veeam server info',
            description:
                'Get VBR server identity: name, build/patch version, database info, and the negotiated REST API version. ' +
                'Call this first to confirm connectivity and to learn which VBR build you are operating against.',
            inputSchema: {},
        },
        async () =>
            runTool(async () => {
                const info = await client.get('/api/v1/serverInfo');
                return { activeApiVersion: client.activeApiVersion, readOnlyMode: client.isReadOnly, serverInfo: info };
            }),
    );

    server.registerTool(
        'veeam_api_request',
        {
            title: 'Veeam raw REST request (advanced)',
            description:
                'Escape hatch for ANY VBR Public REST API v1 endpoint not covered by a dedicated tool — failover plans, ' +
                'SureBackup, agents, cloud/SaaS, tape, tags, etc. Supply the HTTP method and path (e.g. GET ' +
                '"/api/v1/failoverPlans"). This is what makes the server work across every VBR build: if a newer version ' +
                'adds an endpoint, you can reach it here without a code change. In read-only mode, only GET is permitted.',
            inputSchema: {
                method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).describe('HTTP method'),
                path: z.string().describe('API path beginning with /api/v1/ (e.g. "/api/v1/failoverPlans")'),
                query: z
                    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
                    .optional()
                    .describe('Optional query-string parameters as key/value pairs'),
                body: z.any().optional().describe('Optional JSON request body for POST/PUT/PATCH'),
            },
        },
        async ({ method, path, query, body }) =>
            runTool(async () => {
                if (method !== 'GET') client.assertWritable(`${method} ${path}`);
                return client.request({ method, path, query, body });
            }),
    );
}
