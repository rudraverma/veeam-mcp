/**
 * CyberHawk Veeam MCP — tool registration barrel.
 *
 * Built by Rudra Verma | Senior Cyber Security Architect & Researcher | CyberHawk Threat Intel
 * Licensed under the Apache License 2.0.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { VbrClient } from '@/veeam/VbrClient';
import { registerServerTools } from './server';
import { registerJobTools } from './jobs';
import { registerSessionTools } from './sessions';
import { registerBackupTools } from './backups';
import { registerRestoreTools } from './restore';
import { registerInfrastructureTools } from './infrastructure';
import { registerSecurityTools } from './security';

export function registerAllTools(server: McpServer, client: VbrClient): void {
    registerServerTools(server, client);
    registerJobTools(server, client);
    registerSessionTools(server, client);
    registerBackupTools(server, client);
    registerRestoreTools(server, client);
    registerInfrastructureTools(server, client);
    registerSecurityTools(server, client);
}
