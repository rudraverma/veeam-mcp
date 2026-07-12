/**
 * CyberHawk Veeam MCP — security / malware detection tools (VBR 12.1+).
 *
 * These surface Veeam's built-in threat signals — the CTI-relevant angle: ransomware and
 * malware indicators observed against backups feed straight into a detection/IR workflow.
 *
 * Built by Rudra Verma | Senior Cyber Security Architect & Researcher | CyberHawk Threat Intel
 * Licensed under the Apache License 2.0.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { VbrClient } from '@/veeam/VbrClient';
import { runTool } from '@/util/result';

export function registerSecurityTools(server: McpServer, client: VbrClient): void {
    server.registerTool(
        'list_malware_events',
        {
            title: 'List malware / threat detection events (VBR 12.1+)',
            description:
                'List malware-detection events raised by VBR — suspicious activity, infected restore points, encrypted-data ' +
                'and deleted-file anomalies. Requires VBR 12.1 or newer; on older builds this returns an error (that is ' +
                'expected). Feed these events into ransomware detection and incident response.',
            inputSchema: {
                stateFilter: z.string().optional().describe('e.g. detection state / severity where supported'),
                limit: z.number().int().min(1).max(500).optional().describe('Max results'),
            },
        },
        async ({ stateFilter, limit }) =>
            runTool(() =>
                client.get('/api/v1/malwareDetection/events', {
                    stateFilter,
                    limit,
                    orderColumn: 'DetectionTimeUtc',
                    orderAsc: false,
                }),
            ),
    );

    server.registerTool(
        'get_malware_settings',
        {
            title: 'Get malware detection settings (VBR 12.1+)',
            description:
                'Return VBR’s malware-detection configuration (what is enabled, thresholds, exclusions). Requires VBR 12.1+.',
            inputSchema: {},
        },
        async () => runTool(() => client.get('/api/v1/malwareDetection/settings')),
    );
}
