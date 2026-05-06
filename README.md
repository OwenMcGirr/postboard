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
| `CODEX_MODEL` | Optional Codex model override. Leave blank to use the CLI default for your login type |
| `CODEX_TIMEOUT_MS` | Compose timeout in milliseconds |
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
- Web research is manual only and never runs automatically during compose.
- Move server access to SSH keys instead of relying on passwords.
