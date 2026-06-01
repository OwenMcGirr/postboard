# Postboard

Private social post drafting and scheduling with Publer, Codex CLI inference, and Convex-backed author memory.

## Stack

- React + Vite frontend
- Express server for Publer access, compose orchestration, and static hosting
- Convex for single-profile memory storage
- Codex CLI for drafting, interview summarization, and one-off research

## What changed

- The browser no longer depends on a local freeform profile string.
- `/api/ai/compose` now loads memory from Convex and runs `codex exec` on the server.
- Settings now provides:
  - a fixed onboarding interview
  - editable canonical profile memory
  - one-off web research with explicit save
  - saved writing examples
- Docker now persists `CODEX_HOME` so Codex login survives container rebuilds.

## Environment

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `PUBLER_TOKEN` | Publer API token |
| `PUBLER_WORKSPACE_ID` | Publer workspace ID |
| `CONVEX_URL` | Convex deployment URL used by the Express server |
| `VITE_CONVEX_URL` | Convex deployment URL exposed to the client |
| `AGENT_CONTEXT_TOKEN` | Shared bearer token for the headless external-agent context API. Use a long random server-only value |
| `CODEX_MODEL` | Optional Codex model override. Leave blank to use the CLI default for your login type |
| `CODEX_ALLOW_SEARCH` | Set to `true` to allow normal compose requests to use Codex web search |
| `CODEX_TIMEOUT_MS` | Compose timeout in milliseconds. Defaults to `180000` for URL-heavy drafts |
| `BASIC_AUTH_USERNAME` | Username for optional site-level Basic Auth |
| `BASIC_AUTH_PASSWORD` | Password for optional site-level Basic Auth. Leave blank to disable Basic Auth |

## Convex setup

This repo uses a hosted Convex deployment for memory. Create or select a deployment, then set both:

```bash
CONVEX_URL=https://your-deployment.convex.cloud
VITE_CONVEX_URL=https://your-deployment.convex.cloud
```

Useful commands:

```bash
npm run dev:memory
npm run convex:deploy
```

The app uses runtime API references instead of generated client code, so you do not need Convex codegen just to run the UI.

## Local development

Install dependencies and start the app:

```bash
npm install
cp .env.example .env
npm run dev
```

That starts:

- Vite on `http://localhost:3000`
- Express on `http://localhost:3001`

If you want memory enabled locally, run Convex in another shell:

```bash
npm run dev:memory
```

Without Convex configured, compose still works, but memory and settings-based interview features stay disabled.

## Codex CLI auth

Postboard expects Codex CLI auth to exist wherever the Express server runs.

Local machine:

```bash
npx codex login --device-auth
npx codex login status
```

Server or container:

```bash
docker compose exec postboard npx codex login --device-auth
docker compose exec postboard npx codex login status
```

Important notes:

- `CODEX_HOME` is mounted to `/codex-home` in `docker-compose.yml`
- that volume preserves the ChatGPT device login across redeploys
- if you set `CODEX_MODEL`, it must be compatible with the auth type in that environment
- if you want compose to browse the web during normal drafting, set `CODEX_ALLOW_SEARCH=true`
- the Compose screen now shows live Codex activity lines while a draft is in progress

## Memory flow

Settings now drives memory in four parts:

1. Start the interview and answer the fixed sequence of questions.
2. Let Codex summarize that transcript into a canonical writing profile plus structured facts.
3. Optionally run `Research me online`, review the findings, and save only the ones you want.
4. Save approved drafts from Compose as writing examples.

Compose retrieval is deterministic:

- canonical profile is always included
- high-priority facts are included
- latest writing examples are included
- saved research notes are included only when they match the current brief
- external agent context notes are included when they match the brief or have very high importance

## External Agent Context

Trusted agents can send durable notes to Postboard without SSH or Convex credentials. Set `AGENT_CONTEXT_TOKEN` on the server to a long random value, for example:

```bash
openssl rand -hex 32
```

If `AGENT_CONTEXT_TOKEN` or Convex is not configured, `/api/context/*` returns `503`. These endpoints are independent from site-level Basic Auth and require:

```http
Authorization: Bearer <AGENT_CONTEXT_TOKEN>
```

Ingest a note:

```bash
curl -X POST https://your-postboard-host/api/context/ingest \
  -H "Authorization: Bearer $AGENT_CONTEXT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "codex-local",
    "kind": "project",
    "title": "useful-topmost",
    "content": "useful-topmost is a small open-source utility for keeping a chosen window always on top.",
    "tags": ["project", "github", "launch"],
    "url": "https://github.com/OwenMcGirr/useful-topmost",
    "externalId": "github:OwenMcGirr/useful-topmost",
    "importance": 8
  }'
```

Search notes:

```bash
curl "https://your-postboard-host/api/context/search?q=useful-topmost" \
  -H "Authorization: Bearer $AGENT_CONTEXT_TOKEN"
```

Export recent notes:

```bash
curl "https://your-postboard-host/api/context/export?limit=100" \
  -H "Authorization: Bearer $AGENT_CONTEXT_TOKEN"
```

Notes can automatically influence compose prompts when they match the brief. Do not send raw secrets; obvious API keys and private key material are rejected, and `credential_map` notes are inspectable but never auto-injected into compose.

## Docker

Run locally:

```bash
cp .env.example .env
docker compose up --build -d
```

The app binds to:

```text
http://localhost:3000
```

## Deploy

1. Provision a server with Docker and Docker Compose.
2. Clone this repo and create `.env`.
3. Set Publer and Convex environment values.
4. Start the app:

```bash
docker compose up --build -d
```

5. Authenticate Codex inside the running container:

```bash
docker compose exec postboard npx codex login --device-auth
docker compose exec postboard npx codex login status
```

6. Complete the onboarding interview from Settings.

## Operations

Restart:

```bash
docker compose up -d
```

Logs:

```bash
docker compose logs -f
```

Container status:

```bash
docker compose ps
```

Health check:

```bash
curl http://127.0.0.1:3000/healthz
```

## Troubleshooting

- If compose fails with a Codex error, verify `npx codex login status` in the same runtime where Express runs.
- If compose fails only after setting `CODEX_MODEL`, remove it first and retry with the CLI default.
- If Settings says memory is not configured, check both `CONVEX_URL` and `VITE_CONVEX_URL`.
- If the app loads but Publer calls fail, re-check `PUBLER_TOKEN` and `PUBLER_WORKSPACE_ID`.
- If `/healthz` returns `401`, Basic Auth is enabled.

## Security notes

- Publer credentials stay server-side.
- Convex memory is single-profile for the whole deployment.
- `AGENT_CONTEXT_TOKEN` is a shared read/write secret for trusted agents and must stay server-side.
- Context notes should describe useful facts and locations, not credential values.
- Web research is manual only and never runs automatically during compose.
- Move server access to SSH keys instead of relying on passwords.
