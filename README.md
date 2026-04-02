# Arena Oracle

Arena Oracle is an Electron desktop app that watches `MTGA` log output, builds a live game snapshot, and feeds that state into an AI coaching assistant for Magic: The Gathering Arena.

## What it does

- Watches `Player.log` for new game events
- Reconstructs Arena game state from GRE payloads
- Enriches the state with card database lookups
- Sends coaching snapshots to an LLM-backed assistant
- Renders live advice in the desktop UI

## Prerequisites

- Node.js 25.x
- `pnpm`
- Git LFS

Install Git LFS once on your machine before cloning or pulling fixture databases:

```bash
git lfs install
```

## Getting started

```bash
git clone <repo-url>
cd <repo-dir>
pnpm install
pnpm approve-builds
pnpm install
cp .env.template .env
```

This repo enforces `node@^25.0.0` via `package.json` engines and `.npmrc`.

Set the values in `.env` as needed:

- `VITE_OPENROUTER_API_KEY`
- `VITE_GROQ_API_KEY`

## Development

Run the desktop app in development mode:

```bash
pnpm start
```

## Testing

```bash
pnpm check
pnpm lint
pnpm test
pnpm test:e2e
```

## Project notes

- Architecture overview: [docs/architecture.md](docs/architecture.md)
- Contribution workflow: [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)
- Deployment notes: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
