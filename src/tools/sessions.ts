/**
 * CyberHawk Veeam MCP — session inspection + failure diagnosis tools.
 *
 * Sessions are the record of every job run. Their log records are how you answer
 * "why did this job fail?" — the diagnose_job tool stitches that flow together.
 *
 * Built by Rudra Verma | Senior Cyber Security Architect & Researcher | CyberHawk Threat Intel
 * Licensed under the Apache License 2.0.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { VbrClient } from '@/veeam/VbrClient';
import { runTool } from '@/util/result';

interface SessionSummary {
    id: string;
    name?: string;
    jobId?: string;
    result?: { result?: string; message?: string };
    state?: string;
    creationTime?: string;
    endTime?: string;
}

interface SessionList {
    data?: SessionSummary[];
}

interface LogRecords {
    data?: { title?: string; status?: string; updatedTime?: string }[];
}

export function registerSessionTools(server: McpServer, client: VbrClient): void {
    server.registerTool(
        'list_sessions',
        {
            title: 'List job sessions (run history)',
            description:
                'List job run sessions, newest first. Filter by jobId to see one job’s history, by stateFilter ' +
                '("Working"/"Stopped") for live runs, or by typeFilter. Each session ID feeds get_session and get_session_logs.',
            inputSchema: {
                jobId: z.string().optional().describe('Only sessions for this job ID'),
                stateFilter: z.string().optional().describe('e.g. "Working" (running) or "Stopped" (finished)'),
                typeFilter: z.string().optional().describe('Session type, e.g. "Job", "Restore"'),
                limit: z.number().int().min(1).max(500).optional().describe('Max results'),
            },
        },
        async ({ jobId, stateFilter, typeFilter, limit }) =>
            runTool(() =>
                client.get('/api/v1/sessions', {
                    jobIdFilter: jobId,
                    stateFilter,
                    typeFilter,
                    limit,
                    orderColumn: 'CreationTime',
                    orderAsc: false,
                }),
            ),
    );

    server.registerTool(
        'get_session',
        {
            title: 'Get session detail',
            description: 'Get one session: result, state, progress percentage, start/end time, and per-object results.',
            inputSchema: { sessionId: z.string().describe('Session ID (GUID) from list_sessions') },
        },
        async ({ sessionId }) => runTool(() => client.get(`/api/v1/sessions/${sessionId}`)),
    );

    server.registerTool(
        'get_session_logs',
        {
            title: 'Get session log records',
            description:
                'Return the detailed log records for a session — the individual steps and their status. This is the ' +
                'primary source for understanding WHY a run failed or warned (VDDK errors, snapshot failures, network ' +
                'timeouts, repository full, etc.).',
            inputSchema: { sessionId: z.string().describe('Session ID (GUID) from list_sessions') },
        },
        async ({ sessionId }) => runTool(() => client.get(`/api/v1/sessions/${sessionId}/logs`)),
    );

    server.registerTool(
        'stop_session',
        {
            title: 'Stop a running session',
            description: 'Stop an in-progress session by ID (e.g. cancel a stuck run).',
            inputSchema: { sessionId: z.string().describe('Session ID (GUID) from list_sessions') },
        },
        async ({ sessionId }) =>
            runTool(() => {
                client.assertWritable('stop_session');
                return client.post(`/api/v1/sessions/${sessionId}/stop`);
            }),
    );

    server.registerTool(
        'diagnose_job',
        {
            title: 'Diagnose why a job failed',
            description:
                'One-shot triage: given a job ID, find its most recent session, read the failure/warning log records, and ' +
                'return the job state, the latest session result, and the log entries flagged Failed/Warning so you can ' +
                'explain the root cause and propose a fix. Start here whenever the user asks "why is <job> failing?".',
            inputSchema: { jobId: z.string().describe('Job ID (GUID) from list_jobs') },
        },
        async ({ jobId }) =>
            runTool(async () => {
                const [state, sessionsRaw] = await Promise.all([
                    client
                        .get('/api/v1/jobs/states', { idFilter: jobId })
                        .catch(() => ({ note: 'job state unavailable' })),
                    client.get<SessionList>('/api/v1/sessions', {
                        jobIdFilter: jobId,
                        limit: 1,
                        orderColumn: 'CreationTime',
                        orderAsc: false,
                    }),
                ]);

                const latest = sessionsRaw.data?.[0];
                if (!latest) {
                    return { jobState: state, note: 'No sessions found for this job — it may never have run.' };
                }

                const logs = await client.get<LogRecords>(`/api/v1/sessions/${latest.id}/logs`).catch(() => ({ data: [] }));
                const problems = (logs.data ?? []).filter((r) => {
                    const s = (r.status ?? '').toLowerCase();
                    return s === 'failed' || s === 'warning';
                });

                return {
                    jobState: state,
                    latestSession: {
                        id: latest.id,
                        result: latest.result?.result,
                        message: latest.result?.message,
                        state: latest.state,
                        creationTime: latest.creationTime,
                        endTime: latest.endTime,
                    },
                    problemLogRecords: problems.length ? problems : 'No Failed/Warning log records — inspect full logs via get_session_logs.',
                    hint: 'Interpret problemLogRecords for the root cause, then use retry_job, update_job, or the relevant ' +
                        'infrastructure tool to remediate.',
                };
            }),
    );
}
