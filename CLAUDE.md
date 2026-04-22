# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

```
AgentDesignerTest-V2/
├── web-app/       # Production Next.js application — all active development happens here
└── workspace/     # Reference materials: design docs, dev logs, sample inputs/outputs
```

All runnable code lives in `web-app/`. The `workspace/` directory is non-code reference material (not committed to git).

## Working in `web-app/`

**`web-app/CLAUDE.md` is the authoritative development manual** — read it before making changes. It covers startup, architecture, data flow, tool extension, artifact system, testing, and known limitations.

Quick reference:

```bash
cd web-app

npm install
cp .env.example .env.local   # fill in at least one model API key
npm run dev                  # http://localhost:3000

npm test                     # Vitest unit tests
npm run test:e2e             # Playwright E2E (auto-starts dev server)
npm run lint
npm run build
```

## Architecture Overview

A multi-agent web app for C++ game level design. An **Orchestrator LLM** receives user messages and decides which of four specialized sub-agent tools to invoke:

| Tool | Purpose |
|------|---------|
| `designStageFile` | Generate concept packages / planning docs |
| `validateStageFile` | Validate against world-view & pedagogy rules |
| `writeStageFile` | Write final level design documents |
| `generateVisualDesign` | Generate Dreamina (text-to-image) prompts |

**Request path**: `ChatArea` → `POST /api/chat` (with `x-model-id` header) → `streamText` (Orchestrator) → tool invocation → artifact streamed back → `useArtifactStore` (localStorage-persisted) → `ArtifactArea` renders.

**Key layers**:
- `src/app/api/chat/route.ts` — streaming orchestration entry point (~180 lines)
- `src/app/api/chat/tools/` — one file per sub-agent tool
- `src/lib/llm/providers.ts` + `server.ts` — multi-model routing (Gemini, GPT-5, Kimi, DeepSeek, Doubao) via HTTP header
- `src/lib/chat/artifactParser.ts` — decoupled artifact classification and parsing
- `src/store/` — Zustand stores with localStorage persistence
- `src/lib/agents/prompts.ts` — all LLM system prompts

## E2E Test Mode

E2E tests use `x-chat-test-mode: 1` header to skip real LLM calls. Scenario is selected via `[test-scenario:success|tool-error|request-error|approval]` in the message body.

## Adding a New Model

See `web-app/docs/MODELS.md`. Summary: add metadata to `providers.ts`, add a `createModel` case to `server.ts`, update `.env.example`.

## Debug LLM Calls

Send header `x-chat-debug: 1` or set `CHAT_DEBUG=1` env var to get server-side request/response logs including which model was routed.
