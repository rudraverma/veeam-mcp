# **CyberHawk Threat Intel**

<p align="center">
  <img src="https://media.cyberhawkthreatintel.com/general/1771234479938-y9566.png" alt="CyberHawk Threat Intel" width="160"/>
</p>

<h1 align="center">CyberHawk Veeam MCP</h1>
<p align="center">
  <strong>By <a href="https://www.cyberhawkthreatintel.com">CyberHawk Threat Intel</a></strong> · Rudra Verma | Senior Cyber Security Architect &amp; Researcher
</p>

<p align="center">
  <em>A full-operator Model Context Protocol (MCP) server for Veeam Backup &amp; Replication — let Claude read AND control your backup infrastructure through natural language.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Veeam-VBR%2012.x-0066cc?style=flat-square" alt="Veeam VBR 12.x"/>
  <img src="https://img.shields.io/badge/protocol-MCP-5a3fd6?style=flat-square" alt="MCP"/>
  <img src="https://img.shields.io/badge/runtime-Node.js%2020%2B-339933?style=flat-square" alt="Node.js 20+"/>
  <img src="https://img.shields.io/badge/language-TypeScript-3178c6?style=flat-square" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/by-CyberHawk%20Threat%20Intel-0066cc?style=flat-square" alt="by CyberHawk Threat Intel"/>
  <img src="https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square" alt="Apache 2.0"/>
</p>

---

## What this is

**CyberHawk Veeam MCP** turns Claude (Code, Desktop, or any MCP-compatible client) into a hands-on **operator** for Veeam Backup & Replication. Instead of only *asking about* your backups, you can *drive* them:

> *"Start the nightly ESXi backup job."*
> *"Why did the SQL replica job fail last night — and fix it."*
> *"Which repository is almost full?"*
> *"Show me any malware detection events from the last week."*
> *"Create a new backup job for the three web VMs, daily at 2am, to the main repository."*

It speaks the **VBR Public REST API v1** directly — the same documented API the Veeam console uses — so it supports full **read + write** across jobs, sessions, backups, restores, infrastructure, and threat detection.

### How this differs from the official Veeam MCP

The official [`veeam-ai/veeam-mcp-server`](https://github.com/veeam-ai/veeam-mcp-server) is a **read-only proxy to Veeam's cloud "Veeam Intelligence" chatbot** — it exposes a single question-answering tool and requires Advanced mode + a non-Community license. **CyberHawk Veeam MCP is a different design**: it talks straight to your VBR's on-box REST API, needs no cloud service, and exposes **granular operator tools** with real write capability.

| | Official Veeam MCP | CyberHawk Veeam MCP |
|---|---|---|
| Backend | Veeam Intelligence cloud chatbot | VBR on-box REST API v1 |
| Capability | Read-only Q&A | Full read **+ write** operator |
| Tools | 1 (question answering) | 30+ granular tools |
| License requirement | Non-Community + Advanced mode | Any VBR with REST API enabled |
| Cloud dependency | Yes | **No** — stays on your network |

> ⚠️ **Authorized use only.** This server can start, stop, create, and delete jobs and launch restores against production backup infrastructure. Run it only against Veeam instances **you own or are authorized to operate**. Ships with a `VEEAM_READONLY` safety switch.

---

## Capabilities (30+ tools)

| Category | Tools |
|---|---|
| **Discovery** | `veeam_server_info`, `veeam_api_request` (raw escape-hatch to any endpoint) |
| **Jobs — read** | `list_jobs`, `get_job`, `list_job_states`, `get_job_objects` |
| **Jobs — control** | `start_job`, `stop_job`, `retry_job`, `enable_job`, `disable_job` |
| **Jobs — config** | `create_job`, `update_job`, `delete_job` |
| **Sessions & diagnosis** | `list_sessions`, `get_session`, `get_session_logs`, `stop_session`, **`diagnose_job`** |
| **Backups & restore points** | `list_backups`, `get_backup_objects`, `list_restore_points`, `get_restore_point` |
| **Restore** | `list_restore_sessions`, `start_instant_recovery_vmware`, `stop_restore_session` |
| **Infrastructure** | `list_repositories`, `get_repository_states`, `list_proxies`, `list_managed_servers`, `list_credentials`, `browse_inventory` |
| **Security (VBR 12.1+)** | `list_malware_events`, `get_malware_settings` |

**Not limited to hardcoded endpoints.** The `veeam_api_request` tool can reach *any* VBR REST endpoint (failover plans, SureBackup, tape, agents, cloud/SaaS) — so new-version features work without waiting for a code update.

**Cross-version by design.** The required `x-api-version` header is **auto-detected**: the server tries your configured value, then falls back through every known VBR rev until authentication succeeds — so the same build runs against VBR 12.0, 12.1, 12.2, 12.3, and forward.

---

## Requirements

- **Node.js 20+** (or Docker) on the machine that runs the MCP server
- **Veeam Backup & Replication 12.0 or newer** with the **RESTful API service** enabled (default TCP port **9419**)
- A **Veeam account** (Windows local/domain account) that can log into the VBR console
- An **MCP client**: Claude Code, Claude Desktop, VS Code, etc.

> The RESTful API service is installed and enabled by default in VBR 12.x. Verify in *Veeam Backup & Replication Console → Menu → Server Components* or that `https://<vbr-host>:9419/swagger` loads.

---

## Installation

### 1. Clone and build

**Windows (PowerShell):**
```powershell
git clone https://github.com/rudraverma/cyberhawk-veeam-mcp.git
cd cyberhawk-veeam-mcp
npm install
npm run build
```

**macOS / Linux:**
```bash
git clone https://github.com/rudraverma/cyberhawk-veeam-mcp.git
cd cyberhawk-veeam-mcp
npm install
npm run build
```

This produces `build/index.js`.

### 2. Configure credentials

Copy the example env file and fill in your values:

**Windows:**
```powershell
Copy-Item .env.example .env
notepad .env
```

**macOS / Linux:**
```bash
cp .env.example .env
nano .env
```

Minimum required in `.env`:
```
VEEAM_HOST=localhost          # or your VBR host / IP
VEEAM_PORT=9419
VEEAM_USERNAME=DOMAIN\svc-claude
VEEAM_PASSWORD=your-password
VEEAM_ACCEPT_SELF_SIGNED=true
VEEAM_READONLY=false          # true = read-only safety mode
```

> **Recommended:** create a dedicated Windows service account (e.g. `svc-claude`) and grant it a Veeam role under *Users and Roles* in the console, rather than using a personal admin login.

### 3. (Optional) Test it standalone

```bash
npm start
```
You should see `connected to https://localhost:9419 (read-only=false)` on stderr. Press `Ctrl+C` to stop.

Or launch the MCP Inspector to click through the tools:
```bash
npm run inspector
```

---

## Connect it to your MCP client

### Claude Desktop / Claude Code (Windows)

Edit `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "veeam": {
      "command": "node",
      "args": ["D:\\path\\to\\cyberhawk-veeam-mcp\\build\\index.js"],
      "env": {
        "VEEAM_HOST": "localhost",
        "VEEAM_PORT": "9419",
        "VEEAM_USERNAME": "DOMAIN\\svc-claude",
        "VEEAM_PASSWORD": "your-password",
        "VEEAM_ACCEPT_SELF_SIGNED": "true",
        "VEEAM_READONLY": "false"
      }
    }
  }
}
```

### macOS / Linux

```json
{
  "mcpServers": {
    "veeam": {
      "command": "node",
      "args": ["/path/to/cyberhawk-veeam-mcp/build/index.js"],
      "env": {
        "VEEAM_HOST": "vbr.internal.example.com",
        "VEEAM_PORT": "9419",
        "VEEAM_USERNAME": "svc-claude",
        "VEEAM_PASSWORD": "your-password",
        "VEEAM_ACCEPT_SELF_SIGNED": "true",
        "VEEAM_READONLY": "false"
      }
    }
  }
}
```

### Docker

```bash
docker build -t cyberhawk-veeam-mcp .
```
```json
{
  "mcpServers": {
    "veeam": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "--env-file", "/path/to/.env", "cyberhawk-veeam-mcp"]
    }
  }
}
```

Restart your MCP client after editing the config.

---

## Configuration reference

| Variable | Default | Description |
|---|---|---|
| `VEEAM_HOST` | `localhost` | VBR host or IP |
| `VEEAM_PORT` | `9419` | VBR REST API port |
| `VEEAM_BASE_URL` | *(unset)* | Full base URL override (wins over host/port) |
| `VEEAM_USERNAME` | *(required)* | Windows account that can log into VBR |
| `VEEAM_PASSWORD` | *(required)* | Password for that account |
| `VEEAM_API_VERSION` | `1.1-rev1` | Starting `x-api-version` guess (auto-detected) |
| `VEEAM_ACCEPT_SELF_SIGNED` | `true` | Accept VBR's self-signed TLS certificate |
| `VEEAM_READONLY` | `false` | `true` blocks all state-changing tools |
| `VEEAM_TIMEOUT_MS` | `60000` | HTTP request timeout |

**API version map** (only needed if auto-detection is disabled by network policy):

| VBR build | `x-api-version` |
|---|---|
| 12.0 | `1.1-rev0` |
| 12.1 | `1.1-rev1` |
| 12.1.1 / 12.1.2 | `1.1-rev2` |
| 12.2 | `1.2-rev0` |
| 12.3 | `1.2-rev1` |

---

## Usage examples

Once connected, talk to your MCP client naturally:

1. **Health check** — *"Show me the state of all Veeam jobs — anything failed or warning?"*
   → `list_job_states`
2. **Start a job** — *"Run the 'ESXi-Nightly' backup job now."*
   → `list_jobs` → `start_job`
3. **Diagnose a failure** — *"Why did the 'SQL-Replica' job fail last night?"*
   → `diagnose_job` (finds the latest session, reads the failed log records, explains the cause)
4. **Fix and retry** — *"That failed because the repository was full — free space check, then retry the job."*
   → `get_repository_states` → `retry_job`
5. **Capacity review** — *"Which repositories are over 80% used?"*
   → `get_repository_states`
6. **Create a job** — *"Create a daily backup job for VMs web01, web02, web03 to the Main repository at 2am."*
   → `list_managed_servers` → `browse_inventory` → `list_repositories` → `create_job`
7. **Restore point lookup** — *"List the latest restore points for the DC01 VM."*
   → `list_restore_points`
8. **Instant recovery** — *"Instant-recover DC01 from last night's restore point to the ESXi lab host."*
   → `list_restore_points` → `start_instant_recovery_vmware`
9. **Threat hunt** — *"Any Veeam malware detection events this week? Summarize them for an IR ticket."*
   → `list_malware_events`
10. **Advanced / any endpoint** — *"Show me all failover plans."*
    → `veeam_api_request` `GET /api/v1/failoverPlans`

---

## Safety model

Backup infrastructure is critical, so the server is deliberate about writes:

- **`VEEAM_READONLY=true`** turns the server into a pure observability tool — every start/stop/create/delete/restore tool refuses to run and returns a clear message. Great for a first deployment or for read-only analysts.
- **Every mutating tool is explicitly labelled** (e.g. *"destructive"*, *"impactful"*) in its description so the model asks for confirmation on risky actions.
- **No bulk destructive operations** — deletes require a specific job ID; there is no wildcard delete.
- **Credentials never leave your network** — auth goes straight to your VBR host; there is no cloud dependency and secrets are read only from environment variables.

---

## Project structure

```
cyberhawk-veeam-mcp/
├── src/
│   ├── index.ts                 # MCP server entry point
│   ├── config.ts                # env config + validation + API-version candidates
│   ├── veeam/
│   │   └── VbrClient.ts          # OAuth2 auth, token refresh, version auto-detect, request layer
│   ├── util/
│   │   └── result.ts             # MCP tool result helpers
│   └── tools/
│       ├── index.ts              # registers all tool groups
│       ├── server.ts             # server_info + raw api_request
│       ├── jobs.ts               # list/get/control/create/update/delete jobs
│       ├── sessions.ts           # sessions + diagnose_job
│       ├── backups.ts            # backups + restore points
│       ├── restore.ts            # restore operations
│       ├── infrastructure.ts     # repositories, proxies, servers, credentials, inventory
│       └── security.ts           # malware detection (VBR 12.1+)
├── .env.example                  # configuration template (copy to .env)
├── Dockerfile                    # container build
├── esbuild.config.js             # bundler
├── package.json
├── tsconfig.json
├── LICENSE                       # Apache 2.0
└── README.md
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Cannot reach VBR at … (ECONNREFUSED)` | Check `VEEAM_HOST`/`VEEAM_PORT`; confirm the Veeam RESTful API service is running (TCP 9419). |
| `TLS error … self-signed` | Set `VEEAM_ACCEPT_SELF_SIGNED=true` (default). |
| `Authentication failed (401)` | Verify `VEEAM_USERNAME` / `VEEAM_PASSWORD`; the account must be able to log into the VBR console. Note: MFA on the account can break REST auth (known Veeam issue) — use a dedicated non-MFA service account. |
| Every write returns "read-only mode" | You have `VEEAM_READONLY=true`; set it to `false`. |
| `malwareDetection` returns an error | That feature requires VBR 12.1+; older builds don't expose it. |
| A specific action isn't a dedicated tool | Use `veeam_api_request` with the endpoint from `https://<host>:9419/swagger`. |

---

## Related work

- [MISP MCP Tool](https://github.com/rudraverma/MISP-mcp-tool) — full MISP threat-intelligence platform control via MCP
- [MISP Claude Skill](https://github.com/rudraverma/MISP-Claude-Skill) — MISP administration skill
- [FortiOS Fabric Skill](https://github.com/rudraverma/fortios-claude-skill) — Fortinet Security Fabric expert skill

---

## Connect with CyberHawk Threat Intel

<p align="center">
  <a href="https://www.cyberhawkthreatintel.com">
    <img src="https://media.cyberhawkthreatintel.com/general/1771234479938-y9566.png" alt="CyberHawk Threat Intel" width="120"/>
  </a>
</p>

<p align="center">
  <strong>🦅 Sign up FREE → <a href="https://www.cyberhawkthreatintel.com">cyberhawkthreatintel.com</a></strong>
</p>

<p align="center">
  <a href="https://youtube.com/@cyberhawkconsultancy">YouTube @cyberhawkconsultancy</a> ·
  <a href="https://youtube.com/@cyberhawkk">YouTube @cyberhawkk</a> ·
  <a href="https://tiktok.com/@cyberhawkthreatintel">TikTok</a> ·
  <a href="https://x.com/cyberhawkintel">X @cyberhawkintel</a> ·
  <a href="https://t.me/cyberhawkthreatintel">Telegram</a>
</p>

<p align="center">
  <em>Rudra Verma | Senior Cyber Security Architect &amp; Researcher | CyberHawk Threat Intel</em><br/>
  <em>Authorized security research &amp; penetration testing only. Unauthorized use is illegal.</em>
</p>

<p align="center">
  #cyberhawkthreatintel &nbsp;#cyberhawkconsultancy &nbsp;#cyberhawkk &nbsp;#cybersecurity &nbsp;#ethicalhacking &nbsp;#pentesting &nbsp;#redteam &nbsp;#threatintel &nbsp;#infosec
</p>
