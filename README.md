# Postboard

A private tool for composing and scheduling social media posts with AI. Built with React, Vite, and a small Node server that keeps Publer and OpenRouter credentials off the client.

## Overview

- The browser does not talk directly to Publer or OpenRouter.
- All third-party API calls go through the server under `/api`.
- Secrets live in server-side environment variables.
- The app can be protected with HTTP Basic Auth.
- Docker binds to `127.0.0.1:3000` by default.

## Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `PUBLER_TOKEN` | Your Publer API token |
| `PUBLER_WORKSPACE_ID` | Your Publer workspace ID |
| `OPENROUTER_API_KEY` | Your OpenRouter API key |
| `AI_MODEL` | Model to use for generation. `anthropic/claude-sonnet-4.6` is a good default for stronger voice |
| `APP_ORIGIN` | Public origin used in the OpenRouter referer header |
| `BASIC_AUTH_USERNAME` | Username for HTTP Basic Auth |
| `BASIC_AUTH_PASSWORD` | Password for HTTP Basic Auth |

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

That starts:

- Vite on `http://localhost:3000`
- The private API server on `http://localhost:3001`

## Docker

Run the app locally with Docker:

```bash
cp .env.example .env
docker compose up --build -d
```

The app will be available on:

```text
http://localhost:3000
```

## Basic deploy

For a simple private deployment:

1. Create a small Ubuntu VPS.
2. Install Docker and Docker Compose.
3. Clone this repo onto the server.
4. Create `.env` from `.env.example`.
5. Start the app:

```bash
docker compose up --build -d
```

The container binds to `127.0.0.1:3000`, so it is not publicly exposed by default.

## Tailscale access

If you want browser access without buying a domain:

1. Install Tailscale on the server.
2. Install Tailscale on your own device.
3. Log both into the same tailnet.
4. On the server, proxy Tailscale traffic to the app:

```bash
tailscale serve --bg --http=80 http://127.0.0.1:3000
```

Then open the Tailscale URL for the server, for example:

```text
http://postboard.tailnet-name.ts.net/
```

## Operations

Restart the app:

```bash
docker compose up -d
```

View logs:

```bash
docker compose logs -f
```

Check container status:

```bash
docker compose ps
```

## Troubleshooting

- If `http://localhost:3000/healthz` returns `401`, Basic Auth is enabled and you need credentials.
- If the app loads but AI or Publer calls fail, check `.env` for missing or wrong server-side variables.
- If the Tailscale URL does not load, make sure your current device is connected to the same tailnet.

## Security notes

- Do not use old `VITE_*` env variable names.
- Change the default Basic Auth password before real use.
- Rotate any Publer or OpenRouter keys that were previously exposed in client-side env vars.
- Do not keep using a pasted root password on a VPS. Move to SSH keys.
