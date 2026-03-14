# Postboard

A personal tool for composing and scheduling social media posts with AI. Built with React, Vite, and OpenRouter. Supports any platform connected to your Publer account (LinkedIn, X, Facebook, Instagram, etc.).

## Features

- **AI Compose** — describe what you want to post, get a polished draft streamed back
- **Refine** — iterate with quick buttons (flesh out, make shorter, add a hook, etc.) or custom instructions
- **Schedule** — pick accounts and a time, post goes straight to Publer
- **Posts** — browse scheduled, published, and draft posts
- **Media** — browse and upload your Publer media library

## Stack

- React 19 + Vite 8 + TypeScript
- Tailwind CSS v4
- SWR for data fetching
- [Publer API](https://publer.com) for scheduling
- [OpenRouter](https://openrouter.ai) for AI (default: `openai/gpt-4o`)

## Setup

**Prerequisites:** A [Publer](https://publer.com) Business/Enterprise account (API access required) and an [OpenRouter](https://openrouter.ai) account.

1. Clone the repo and install dependencies:

```bash
npm install
```

2. Copy the example env file and fill in your credentials:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `VITE_PUBLER_TOKEN` | Your Publer API token (Settings → API) |
| `VITE_PUBLER_WORKSPACE_ID` | Your Publer workspace ID |
| `VITE_OPENROUTER_API_KEY` | Your OpenRouter API key |
| `VITE_AI_MODEL` | Model to use (default: `openai/gpt-4o`) |

3. Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Building

```bash
npm run build
```

## Notes

- Credentials are stored only in `.env` — never committed
- All API calls go directly from the browser to Publer and OpenRouter (no backend)
- The AI system prompt is tuned for LinkedIn content for a tech founder — edit `src/lib/ai-client.ts` to change the tone/persona
