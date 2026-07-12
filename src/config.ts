/**
 * CyberHawk Veeam MCP — configuration.
 * Reads connection + auth settings from environment variables and validates them.
 *
 * Built by Rudra Verma | Senior Cyber Security Architect & Researcher | CyberHawk Threat Intel
 * Licensed under the Apache License 2.0.
 */

import { z } from 'zod';

/**
 * Candidate `x-api-version` header values, newest first. The VBR REST API requires
 * this header, and the accepted value differs per build. We try the configured value
 * first, then fall back through this list so the server works against any 12.x build
 * (and forward) without the user having to know their exact rev.
 */
export const API_VERSION_CANDIDATES = ['1.2-rev1', '1.2-rev0', '1.1-rev2', '1.1-rev1', '1.1-rev0'] as const;

const boolFromEnv = (fallback: boolean) =>
    z.preprocess((val) => {
        if (typeof val !== 'string') return fallback;
        const v = val.toLowerCase().trim();
        if (v === '') return fallback;
        return v === 'true' || v === '1' || v === 'yes';
    }, z.boolean());

const settingsSchema = z.object({
    // Where VBR lives. On the backup server itself this is localhost; anyone cloning
    // the repo points these at their own VBR host/IP.
    VEEAM_HOST: z.string().min(1).default('localhost'),
    VEEAM_PORT: z.coerce.number().int().positive().default(9419),

    // Full base URL override. When set, wins over VEEAM_HOST/VEEAM_PORT — useful behind
    // a reverse proxy or a non-standard path.
    VEEAM_BASE_URL: z.string().url().optional(),

    // Credentials. On a localhost VBR these are a Windows account that can log into the
    // Veeam console; a dedicated service account (e.g. svc-claude) is recommended.
    VEEAM_USERNAME: z.string().min(1, 'VEEAM_USERNAME is required'),
    VEEAM_PASSWORD: z.string().min(1, 'VEEAM_PASSWORD is required'),

    // Starting API version guess; auto-detection falls back through API_VERSION_CANDIDATES.
    VEEAM_API_VERSION: z.string().min(1).default('1.1-rev1'),

    // VBR ships a self-signed certificate by default, so accept it unless told otherwise.
    VEEAM_ACCEPT_SELF_SIGNED: boolFromEnv(true),

    // Safety switch: when true, every mutating tool refuses to run and only reads are allowed.
    VEEAM_READONLY: boolFromEnv(false),

    VEEAM_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
});

export type Settings = z.infer<typeof settingsSchema>;

export interface ResolvedConfig extends Settings {
    baseURL: string;
}

function baseUrlFor(s: Settings): string {
    if (s.VEEAM_BASE_URL) return s.VEEAM_BASE_URL.replace(/\/+$/, '');
    return `https://${s.VEEAM_HOST}:${s.VEEAM_PORT}`;
}

export function loadConfig(): ResolvedConfig {
    try {
        const parsed = settingsSchema.parse(process.env);
        return { ...parsed, baseURL: baseUrlFor(parsed) };
    } catch (err) {
        if (err instanceof z.ZodError) {
            const lines = err.issues.map((i) => ` - ${i.path.join('.')}: ${i.message}`);
            throw new Error(`Invalid Veeam MCP configuration:\n${lines.join('\n')}`);
        }
        throw err;
    }
}
