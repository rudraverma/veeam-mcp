/**
 * CyberHawk Veeam MCP — VBR Public REST API v1 client.
 *
 * Handles OAuth2 password-grant authentication, transparent token refresh, the mandatory
 * `x-api-version` header (with auto-detection across VBR builds), self-signed certificate
 * acceptance, and a single 401-retry. All tool modules go through this client.
 *
 * Built by Rudra Verma | Senior Cyber Security Architect & Researcher | CyberHawk Threat Intel
 * Licensed under the Apache License 2.0.
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import https from 'node:https';
import { API_VERSION_CANDIDATES, ResolvedConfig } from '@/config';

const TOKEN_URL = '/api/oauth2/token';
/** Refresh a little before the real expiry so an in-flight request never races the clock. */
const EXPIRY_BUFFER_MS = 30_000;

interface TokenResponse {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in: number;
}

export interface VeeamRequest {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    path: string;
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
    /** Extra headers merged last (rarely needed). */
    headers?: Record<string, string>;
}

/** Thrown when a write is attempted while VEEAM_READONLY=true. */
export class ReadOnlyError extends Error {
    constructor(operation: string) {
        super(
            `Refused: "${operation}" is a state-changing operation but the server is running in read-only mode ` +
                `(VEEAM_READONLY=true). Set VEEAM_READONLY=false to allow write operations.`,
        );
        this.name = 'ReadOnlyError';
    }
}

export class VbrClient {
    readonly config: ResolvedConfig;
    private readonly http: AxiosInstance;

    private apiVersion: string;
    private accessToken: string | null = null;
    private refreshToken: string | null = null;
    private tokenExpiresAt = 0;

    constructor(config: ResolvedConfig) {
        this.config = config;
        this.apiVersion = config.VEEAM_API_VERSION;
        this.http = axios.create({
            baseURL: config.baseURL,
            timeout: config.VEEAM_TIMEOUT_MS,
            httpsAgent: new https.Agent({ rejectUnauthorized: !config.VEEAM_ACCEPT_SELF_SIGNED }),
        });
    }

    get isReadOnly(): boolean {
        return this.config.VEEAM_READONLY;
    }

    /** Guard placed at the top of every mutating tool. */
    assertWritable(operation: string): void {
        if (this.isReadOnly) throw new ReadOnlyError(operation);
    }

    /** The API version that actually authenticated — surfaced by the server_info tool. */
    get activeApiVersion(): string {
        return this.apiVersion;
    }

    // ── Public request surface ────────────────────────────────────────────────

    async request<T = unknown>(req: VeeamRequest): Promise<T> {
        await this.ensureToken();
        try {
            return await this.send<T>(req);
        } catch (error) {
            // One transparent retry: a 401 usually means the token lapsed between calls.
            if (axios.isAxiosError(error) && error.response?.status === 401) {
                await this.authenticate();
                return this.send<T>(req);
            }
            throw this.wrap(error);
        }
    }

    get<T = unknown>(path: string, query?: VeeamRequest['query']): Promise<T> {
        return this.request<T>({ method: 'GET', path, query });
    }

    post<T = unknown>(path: string, body?: unknown, query?: VeeamRequest['query']): Promise<T> {
        return this.request<T>({ method: 'POST', path, body, query });
    }

    put<T = unknown>(path: string, body?: unknown): Promise<T> {
        return this.request<T>({ method: 'PUT', path, body });
    }

    del<T = unknown>(path: string): Promise<T> {
        return this.request<T>({ method: 'DELETE', path });
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private async send<T>(req: VeeamRequest): Promise<T> {
        const config: AxiosRequestConfig = {
            method: req.method,
            url: req.path,
            params: req.query,
            data: req.body,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'x-api-version': this.apiVersion,
                Authorization: `Bearer ${this.accessToken}`,
                ...req.headers,
            },
        };
        const res = await this.http.request<T>(config);
        return res.data;
    }

    private async ensureToken(): Promise<void> {
        if (this.accessToken && Date.now() < this.tokenExpiresAt - EXPIRY_BUFFER_MS) return;
        if (this.refreshToken) {
            try {
                await this.grant({ grant_type: 'refresh_token', refresh_token: this.refreshToken });
                return;
            } catch {
                // Refresh token expired/revoked — fall through to a full re-auth.
            }
        }
        await this.authenticate();
    }

    /**
     * Full password-grant login. Tries the configured API version first, then walks the
     * candidate list so a wrong VEEAM_API_VERSION never blocks a working VBR.
     */
    private async authenticate(): Promise<void> {
        const ordered = [this.apiVersion, ...API_VERSION_CANDIDATES.filter((v) => v !== this.apiVersion)];
        let lastError: unknown;

        for (const version of ordered) {
            try {
                await this.grant(
                    {
                        grant_type: 'password',
                        username: this.config.VEEAM_USERNAME,
                        password: this.config.VEEAM_PASSWORD,
                    },
                    version,
                );
                this.apiVersion = version; // lock in the version that worked
                return;
            } catch (error) {
                lastError = error;
                if (!this.isVersionMismatch(error) && !this.isAuthRejection(error)) {
                    // A network/TLS failure won't be fixed by trying another version — stop early.
                    throw this.wrap(error);
                }
                // On an outright credential rejection there's no point trying other versions.
                if (this.isAuthRejection(error)) throw this.wrap(error);
            }
        }
        throw this.wrap(lastError);
    }

    private async grant(fields: Record<string, string>, version = this.apiVersion): Promise<void> {
        const body = new URLSearchParams(fields).toString();
        const res = await this.http.post<TokenResponse>(TOKEN_URL, body, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
                'x-api-version': version,
            },
        });
        const data = res.data;
        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token ?? this.refreshToken;
        this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
    }

    private isVersionMismatch(error: unknown): boolean {
        if (!axios.isAxiosError(error)) return false;
        const status = error.response?.status;
        if (status === 400 || status === 406 || status === 415) return true;
        const detail = JSON.stringify(error.response?.data ?? '').toLowerCase();
        return detail.includes('api-version') || detail.includes('api version');
    }

    private isAuthRejection(error: unknown): boolean {
        if (!axios.isAxiosError(error)) return false;
        return error.response?.status === 401;
    }

    /** Turn low-level axios/TLS errors into messages an operator can act on. */
    private wrap(error: unknown): Error {
        if (axios.isAxiosError(error)) {
            const code = error.code ?? '';
            if (['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN'].includes(code)) {
                return new Error(
                    `Cannot reach VBR at ${this.config.baseURL} (${code}). Check VEEAM_HOST/VEEAM_PORT and that the ` +
                        `Veeam RESTful API service is running (default TCP 9419).`,
                );
            }
            if (['DEPTH_ZERO_SELF_SIGNED_CERT', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'].includes(code)) {
                return new Error(
                    `TLS error talking to VBR (${code}). VBR uses a self-signed certificate by default — set ` +
                        `VEEAM_ACCEPT_SELF_SIGNED=true (it is on by default).`,
                );
            }
            const status = error.response?.status;
            if (status === 401) {
                return new Error('Authentication failed (401). Verify VEEAM_USERNAME / VEEAM_PASSWORD.');
            }
            const payload = error.response?.data;
            const detail = payload ? ` — ${typeof payload === 'string' ? payload : JSON.stringify(payload)}` : '';
            return new Error(`VBR API error${status ? ` ${status}` : ''}: ${error.message}${detail}`);
        }
        return error instanceof Error ? error : new Error(String(error));
    }
}
