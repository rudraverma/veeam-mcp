/**
 * CyberHawk Veeam MCP — restore operation tools.
 *
 * Restore endpoints are the most version-sensitive part of the VBR REST API — the exact
 * request shape for instant recovery / full VM restore shifts between builds. These tools
 * cover the common VMware paths; for anything build-specific, use veeam_api_request with the
 * spec from your VBR's Swagger page (https://<host>:9419/swagger).
 *
 * Built by Rudra Verma | Senior Cyber Security Architect & Researcher | CyberHawk Threat Intel
 * Licensed under the Apache License 2.0.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { VbrClient } from '@/veeam/VbrClient';
import { runTool } from '@/util/result';

export function registerRestoreTools(server: McpServer, client: VbrClient): void {
    server.registerTool(
        'list_restore_sessions',
        {
            title: 'List restore sessions',
            description: 'List restore operations (their sessions) so you can track progress of an in-flight recovery.',
            inputSchema: {
                stateFilter: z.string().optional().describe('e.g. "Working" or "Stopped"'),
                limit: z.number().int().min(1).max(500).optional().describe('Max results'),
            },
        },
        async ({ stateFilter, limit }) =>
            runTool(() =>
                client.get('/api/v1/sessions', {
                    typeFilter: 'Restore',
                    stateFilter,
                    limit,
                    orderColumn: 'CreationTime',
                    orderAsc: false,
                }),
            ),
    );

    server.registerTool(
        'start_instant_recovery_vmware',
        {
            title: 'Start VMware Instant Recovery (destructive/impactful)',
            description:
                'Launch Instant Recovery of a VMware VM directly from a backup restore point. Impactful — it publishes a ' +
                'running VM into your vSphere environment. Provide the restore point ID and the VMware restore specification ' +
                '(target host, resource pool, datastore, VM name, power-on, NIC mapping) per your VBR build’s schema. If your ' +
                'build’s field names differ, fetch the exact schema from https://<host>:9419/swagger and submit via ' +
                'veeam_api_request instead.',
            inputSchema: {
                restorePointId: z.string().describe('Restore point ID (GUID) from list_restore_points'),
                restoreSpec: z
                    .any()
                    .describe('VMware Instant Recovery specification JSON (target, datastore, VM name, power-on, NICs)'),
            },
        },
        async ({ restorePointId, restoreSpec }) =>
            runTool(() => {
                client.assertWritable('start_instant_recovery_vmware');
                const body = { restorePointId, ...(restoreSpec as Record<string, unknown>) };
                return client.post('/api/v1/restore/instantRecovery/vmware/vSphere', body);
            }),
    );

    server.registerTool(
        'stop_restore_session',
        {
            title: 'Stop a restore session',
            description: 'Stop an in-progress restore session (e.g. cancel a mount / Instant Recovery publish).',
            inputSchema: { sessionId: z.string().describe('Restore session ID (GUID) from list_restore_sessions') },
        },
        async ({ sessionId }) =>
            runTool(() => {
                client.assertWritable('stop_restore_session');
                return client.post(`/api/v1/sessions/${sessionId}/stop`);
            }),
    );
}
