# UNLAWYERED

> **Legal AI for people who don't speak legal.** Starts with Indian law.

Five plain-English tools: explain a law, ask a legal question, review a document,
cross-check against Indian law with citations, and stress-test a contract. Every
AI claim is shown next to its sources, and everything the app says is legal
**information**, never legal advice.

## Monorepo layout

```
unlawyered/
├── apps/
│   ├── server/        Node + Express + TypeScript API (all AI calls happen here)
│   └── web/           React + Vite + TypeScript front end
└── packages/
    └── shared/        Types & schemas shared by server and web
```

**First principle:** no keys in the browser. You choose an AI provider (Gemini,
OpenAI, Anthropic, or a keyless Mock) on the Settings page; the key is sent once
over HTTPS to the backend, encrypted at rest, and never returned to the client.
All provider calls go through the backend's modular provider layer, so switching
providers later needs zero rewrites.

## Quickstart

```bash
npm install
npm run dev:server   # http://localhost:8787
npm run dev:web      # http://localhost:5173
```

Open http://localhost:5173 → **Settings** → pick a provider → paste your API key
(never leaves your machine except to the backend, encrypted at rest) → **Test
connection**. The Mock provider needs no key and is the default, so every tool
works out of the box.

## API routes

| Route | Purpose |
| --- | --- |
| `GET  /api/health` | Milestone-1 connectivity check |
| `GET  /api/providers` | Available providers + which has a key configured |
| `POST /api/settings/provider` | Store provider choice |
| `POST /api/settings/key` | Store an API key (encrypted at rest) |
| `DELETE /api/settings/key` | Forget the stored key |
| `POST /api/settings/test` | Test the provider connection server-side |
| `POST /api/ask` | Ask a legal question (with sources) |
| `POST /api/explain-law` | Explain an Indian law in plain English |
| `POST /api/review-document` | Plain-English document review |
| `POST /api/cross-check` | Cross-check a document against Indian law, with citations |
| `POST /api/stress-test` | Stress-test a contract clause by clause |
| `POST /api/documents` | Upload txt / md / pdf / docx (shared by every document tool) |

## Development

```bash
npm run typecheck   # all workspaces
npm test            # server test suite (vitest, incl. live e2e via tests/e2e.mjs)
npm run build       # shared → server → web
```

## Disclaimer

UNLAWYERED provides legal **information**, not legal advice. It does not create
an advocate–client relationship. AI output can be wrong or out of date —
independently verify everything against primary sources, and consult a qualified
advocate for advice on your actual situation.
