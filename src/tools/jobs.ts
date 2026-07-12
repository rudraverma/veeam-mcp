/**
 * CyberHawk Veeam MCP — job read + control tools.
 *
 * Covers the full lifecycle: list/inspect jobs and their states, start/stop/retry runs,
 * enable/disable, and create/update/delete job configurations.
 *
 * Built by Rudra Verma | Senior Cyber Security Architect & Researcher | CyberHawk Threat Intel
 * Licensed under the Apache License 2.0.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { VbrClient } from '@/veeam/VbrClient';
import { runTool } from '@/util/result';

export function registerJobTools(server: McpServer, client: VbrClient): void {
    // ── Read ──────────────────────────────────────────────────────────────────

    server.registerTool(
        'list_jobs',
        {
            title: 'List backup/replication jobs',
            description:
                'List all configured jobs (backup, replication, backup copy, agent, etc.) with their IDs and settings. ' +
                'Use nameFilter to narrow by job name and typeFilter to narrow by job type. Job IDs returned here feed ' +
                'every other job tool.',
            inputSchema: {
                nameFilter: z.string().optional().describe('Case-insensitive substring match on job name'),
                typeFilter: z
                    .string()
                    .optional()
                    .describe('Filter by job type, e.g. "Backup", "Replication", "BackupCopy"'),
                skip: z.number().int().min(0).optional().describe('Pagination offset'),
                limit: z.number().int().min(1).max(500).optional().describe('Max results (default server-side)'),
            },
        },
        async ({ nameFilter, typeFilter, skip, limit }) =>
            runTool(() =>
                client.get('/api/v1/jobs', {
                    nameFilter,
                    typeFilter,
                    skip,
                    limit,
                }),
            ),
    );

    server.registerTool(
        'get_job',
        {
            title: 'Get job configuration',
            description: 'Get the full configuration of a single job by its ID (schedule, virtual objects, storage, retention).',
            inputSchema: { jobId: z.string().describe('Job ID (GUID) from list_jobs') },
        },
        async ({ jobId }) => runTool(() => client.get(`/api/v1/jobs/${jobId}`)),
    );

    server.registerTool(
        'list_job_states',
        {
            title: 'List job states (status / last result / next run)',
            description:
                'Return the live state of jobs: current status (running/idle), last result (Success/Warning/Failed), ' +
                'last run time, next scheduled run, and progress. This is the fastest way to answer "what is failing?" ' +
                'or "what is running right now?".',
            inputSchema: {
                nameFilter: z.string().optional().describe('Case-insensitive substring match on job name'),
            },
        },
        async ({ nameFilter }) => runTool(() => client.get('/api/v1/jobs/states', { nameFilter })),
    );

    server.registerTool(
        'get_job_objects',
        {
            title: 'List objects included in a job',
            description: 'List the VMs / machines / objects that a given job protects.',
            inputSchema: { jobId: z.string().describe('Job ID (GUID) from list_jobs') },
        },
        async ({ jobId }) => runTool(() => client.get(`/api/v1/jobs/${jobId}/includes`)),
    );

    // ── Run control ───────────────────────────────────────────────────────────

    server.registerTool(
        'start_job',
        {
            title: 'Start a job',
            description:
                'Start a backup/replication job now. Returns the session that was created — pass its ID to get_session / ' +
                'get_session_logs to follow progress.',
            inputSchema: { jobId: z.string().describe('Job ID (GUID) from list_jobs') },
        },
        async ({ jobId }) =>
            runTool(() => {
                client.assertWritable('start_job');
                return client.post(`/api/v1/jobs/${jobId}/start`);
            }),
    );

    server.registerTool(
        'stop_job',
        {
            title: 'Stop a running job',
            description: 'Gracefully stop a currently running job. Optionally set graceful=false to stop immediately.',
            inputSchema: {
                jobId: z.string().describe('Job ID (GUID) from list_jobs'),
                graceful: z.boolean().optional().describe('Graceful stop (default true)'),
            },
        },
        async ({ jobId, graceful }) =>
            runTool(() => {
                client.assertWritable('stop_job');
                return client.post(`/api/v1/jobs/${jobId}/stop`, undefined, { graceful });
            }),
    );

    server.registerTool(
        'retry_job',
        {
            title: 'Retry a failed job',
            description: 'Retry the failed objects of a job after a Failed/Warning result.',
            inputSchema: { jobId: z.string().describe('Job ID (GUID) from list_jobs') },
        },
        async ({ jobId }) =>
            runTool(() => {
                client.assertWritable('retry_job');
                return client.post(`/api/v1/jobs/${jobId}/retry`);
            }),
    );

    server.registerTool(
        'enable_job',
        {
            title: 'Enable a job',
            description: 'Enable a disabled job so it runs on its schedule again.',
            inputSchema: { jobId: z.string().describe('Job ID (GUID) from list_jobs') },
        },
        async ({ jobId }) =>
            runTool(() => {
                client.assertWritable('enable_job');
                return client.post(`/api/v1/jobs/${jobId}/enable`);
            }),
    );

    server.registerTool(
        'disable_job',
        {
            title: 'Disable a job',
            description: 'Disable a job so it no longer runs on schedule (does not delete it).',
            inputSchema: { jobId: z.string().describe('Job ID (GUID) from list_jobs') },
        },
        async ({ jobId }) =>
            runTool(() => {
                client.assertWritable('disable_job');
                return client.post(`/api/v1/jobs/${jobId}/disable`);
            }),
    );

    // ── Configuration (create / update / delete) ──────────────────────────────

    server.registerTool(
        'create_job',
        {
            title: 'Create a new job',
            description:
                'Create a new backup/replication job. Provide the full job specification object as documented by the VBR ' +
                'REST API for your build. Tip: call get_job on an existing similar job to obtain a template spec, edit it, ' +
                'and pass it here.',
            inputSchema: {
                jobSpec: z.any().describe('Full job specification JSON per the VBR REST API schema'),
            },
        },
        async ({ jobSpec }) =>
            runTool(() => {
                client.assertWritable('create_job');
                return client.post('/api/v1/jobs', jobSpec);
            }),
    );

    server.registerTool(
        'update_job',
        {
            title: 'Update a job configuration',
            description:
                'Replace a job configuration by ID. Fetch the current spec with get_job, modify the fields you need ' +
                '(schedule, retention, included objects, repository), and pass the whole object back here.',
            inputSchema: {
                jobId: z.string().describe('Job ID (GUID) from list_jobs'),
                jobSpec: z.any().describe('Full updated job specification JSON'),
            },
        },
        async ({ jobId, jobSpec }) =>
            runTool(() => {
                client.assertWritable('update_job');
                return client.put(`/api/v1/jobs/${jobId}`, jobSpec);
            }),
    );

    server.registerTool(
        'delete_job',
        {
            title: 'Delete a job (destructive)',
            description:
                'Permanently delete a job configuration by ID. Destructive — the job and its schedule are removed. ' +
                'Backups already created are retained unless removed separately. Requires a specific job ID; there is no bulk delete.',
            inputSchema: { jobId: z.string().describe('Job ID (GUID) from list_jobs') },
        },
        async ({ jobId }) =>
            runTool(() => {
                client.assertWritable('delete_job');
                return client.del(`/api/v1/jobs/${jobId}`);
            }),
    );
}
