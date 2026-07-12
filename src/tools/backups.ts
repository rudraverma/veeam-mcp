/**
 * CyberHawk Veeam MCP — backups + restore point tools.
 *
 * Built by Rudra Verma | Senior Cyber Security Architect & Researcher | CyberHawk Threat Intel
 * Licensed under the Apache License 2.0.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { VbrClient } from '@/veeam/VbrClient';
import { runTool } from '@/util/result';

export function registerBackupTools(server: McpServer, client: VbrClient): void {
    server.registerTool(
        'list_backups',
        {
            title: 'List backups',
            description:
                'List backup chains known to VBR (the stored result of jobs). Each backup groups the restore points for its ' +
                'protected objects. Filter by name where supported.',
            inputSchema: {
                nameFilter: z.string().optional().describe('Case-insensitive substring match on backup name'),
                limit: z.number().int().min(1).max(500).optional().describe('Max results'),
            },
        },
        async ({ nameFilter, limit }) => runTool(() => client.get('/api/v1/backups', { nameFilter, limit })),
    );

    server.registerTool(
        'get_backup_objects',
        {
            title: 'List objects in a backup',
            description: 'List the protected objects (VMs/machines) contained in a specific backup.',
            inputSchema: { backupId: z.string().describe('Backup ID (GUID) from list_backups') },
        },
        async ({ backupId }) => runTool(() => client.get(`/api/v1/backups/${backupId}/objects`)),
    );

    server.registerTool(
        'list_restore_points',
        {
            title: 'List restore points',
            description:
                'List recovery points available to restore from. Filter by nameFilter to find points for a specific VM/machine. ' +
                'Restore point IDs feed the restore tools.',
            inputSchema: {
                nameFilter: z.string().optional().describe('Case-insensitive substring match on object name'),
                platformFilter: z.string().optional().describe('e.g. "VmWare", "HyperV", "WindowsPhysical"'),
                limit: z.number().int().min(1).max(500).optional().describe('Max results'),
            },
        },
        async ({ nameFilter, platformFilter, limit }) =>
            runTool(() =>
                client.get('/api/v1/restorePoints', {
                    nameFilter,
                    platformNameFilter: platformFilter,
                    limit,
                    orderColumn: 'CreationTime',
                    orderAsc: false,
                }),
            ),
    );

    server.registerTool(
        'get_restore_point',
        {
            title: 'Get restore point detail',
            description: 'Get details for a single restore point: creation time, type (full/incremental), and source object.',
            inputSchema: { restorePointId: z.string().describe('Restore point ID (GUID) from list_restore_points') },
        },
        async ({ restorePointId }) => runTool(() => client.get(`/api/v1/restorePoints/${restorePointId}`)),
    );
}
