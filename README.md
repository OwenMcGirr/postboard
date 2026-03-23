# Postboard

A private tool for composing and scheduling social media posts with AI. Built with React, Vite, and a small Node server that keeps Publer and OpenRouter credentials off the client.

## What changed

- The browser no longer talks directly to Publer or OpenRouter.
- All third-party API calls now go through a local server under `/api`.
- Secrets live only in server-side environment variables.
- Optional HTTP Basic Auth can lock down the whole app.
- Docker is configured to bind only to `127.0.0.1:3000` by default.

## Environment

Copy `.env.example` to `.env` and fill in your values:

| Variable | Description |
|---|---|
| `PUBLER_TOKEN` | Your Publer API token |
| `PUBLER_WORKSPACE_ID` | Your Publer workspace ID |
| `OPENROUTER_API_KEY` | Your OpenRouter API key |
| `AI_MODEL` | Model to use for generation |
| `APP_ORIGIN` | Public origin used in the OpenRouter referer header |
| `BASIC_AUTH_USERNAME` | Username for HTTP Basic Auth |
| `BASIC_AUTH_PASSWORD` | Password for HTTP Basic Auth. Leave unset to disable. |

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

That starts:

- Vite on `http://localhost:3000`
- The private API server on `http://localhost:3001`

The Vite dev server proxies `/api` to the local backend.

## Docker

Build and run privately on the local machine:

```bash
cp .env.example .env
docker compose up --build -d
```

The compose file binds the app to `127.0.0.1:3000`, so it is not exposed on your network by default.

Important:

- Use the server-side variable names from `.env.example`.
- Do not keep using the old `VITE_*` names in `.env`.
- Rotate any Publer or OpenRouter keys that were previously stored as `VITE_*` values.

## Private hosting

If you want remote access without making the app public:

- run the Docker container on a VPS or home server
- keep the port bound to localhost
- reach it over Tailscale, SSH tunneling, or another private network layer

## Scripts

- `npm run dev` starts the client and private API together
- `npm run build` builds the frontend
- `npm run start` serves the built frontend and API from one process
