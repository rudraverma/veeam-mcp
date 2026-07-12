/**
 * CyberHawk Veeam MCP — backup infrastructure tools (repositories, proxies, managed servers, credentials, inventory).
 *
 * Built by Rudra Verma | Senior Cyber Security Architect & Researcher | CyberHawk Threat Intel
 * Licensed under the Apache License 2.0.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { VbrClient } from '@/veeam/VbrClient';
import { runTool } from '@/util/result';

export function registerInfrastructureTools(server: McpServer, client: VbrClient): void {
    server.registerTool(
        'list_repositories',
        {
            title: 'List backup repositories',
            description: 'List all backup repositories (their type, path, and configuration).',
            inputSchema: {
                nameFilter: z.string().optional().describe('Case-insensitive substring match on repository name'),
            },
        },
        async ({ nameFilter }) => runTool(() => client.get('/api/v1/backupInfrastructure/repositories', { nameFilter })),
    );

    server.registerTool(
        'get_repository_states',
        {
            title: 'Repository capacity / free space',
            description:
                'Return capacity, used space, and free space per repository. Use this to answer "is a repository full?" — ' +
                'a common root cause of Failed backups.',
            inputSchema: {},
        },
        async () => runTool(() => client.get('/api/v1/backupInfrastructure/repositories/states')),
    );

    server.registerTool(
        'list_proxies',
        {
            title: 'List backup proxies',
            description: 'List backup proxies and their configuration (transport mode, max concurrent tasks).',
            inputSchema: {},
        },
        async () => runTool(() => client.get('/api/v1/backupInfrastructure/proxies')),
    );

    server.registerTool(
        'list_managed_servers',
        {
            title: 'List managed servers',
            description:
                'List servers managed by VBR (vCenter/ESXi hosts, Windows/Linux servers). Host IDs here are needed when ' +
                'browsing inventory to build a job.',
            inputSchema: {},
        },
        async () => runTool(() => client.get('/api/v1/backupInfrastructure/managedServers')),
    );

    server.registerTool(
        'list_credentials',
        {
            title: 'List stored credentials (metadata only)',
            description:
                'List credential records known to VBR (usernames/descriptions and their IDs — never secrets). Credential IDs ' +
                'are referenced when creating jobs or adding managed servers.',
            inputSchema: {},
        },
        async () => runTool(() => client.get('/api/v1/credentials')),
    );

    server.registerTool(
        'browse_inventory',
        {
            title: 'Browse virtual infrastructure inventory',
            description:
                'Browse the virtual infrastructure (hosts, folders, VMs) beneath a managed server so you can select objects ' +
                'to include when creating a job. Provide the hostId from list_managed_servers.',
            inputSchema: {
                hostId: z.string().describe('Managed server / host ID (GUID) from list_managed_servers'),
                viewType: z
                    .string()
                    .optional()
                    .describe('Inventory view, e.g. "HostsAndClusters", "VMsAndTemplates"'),
            },
        },
        async ({ hostId, viewType }) =>
            runTool(() => client.get(`/api/v1/inventory/${hostId}`, { viewType })),
    );
}
