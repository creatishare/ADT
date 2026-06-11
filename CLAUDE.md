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
cp .env.example .env.local   # only HETAO_GATEWAY_API_KEY is required
npm run dev                  # http://localhost:3000

npx vitest run               # Vitest unit tests (prefer over `npm test`, which may carry a stale e2e filter)
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
- `src/app/api/chat/route.ts` — streaming orchestration entry point (~700 lines, incl. guidance fallback + memory)
- `src/app/api/chat/tools/` — one file per sub-agent tool; `designStageFile` runs a lint+retry loop (blacklist + stage-mechanism diversity check)
- `src/lib/llm/` — all 6 UI models route through the single company `hetao` gateway (OpenAI-compatible); one `HETAO_GATEWAY_API_KEY`, upstream aliases overridable via `HETAO_MODEL_<UI_ID>` env vars. Never connect directly to external LLM vendors (compliance).
- `src/lib/agents/` — `prompts.ts` (all system prompts) + `rules/` (black/whitelists, lint) + `schemas/` (ConceptSchema with `dramaticConflict` / `stageMechanism`) + `guidance.ts` (structured per-scope user preferences)
- `src/lib/chat/artifactParser.ts` — decoupled artifact classification and parsing
- `src/store/` — Zustand stores with localStorage persistence (per-session artifacts)

**Anti-homogenization (2026-06-11)**: concepts must differ on two axes — theme (≥3 of 8) and stage mechanism (`StageMechanism` enum, all 5 pairwise distinct, enforced by `findDuplicateMechanisms` in the lint+retry loop, not by Zod refine).

## E2E Test Mode

E2E tests use `x-chat-test-mode: 1` header to skip real LLM calls. Scenario is selected via `[test-scenario:success|tool-error|request-error|approval]` in the message body.

## Adding a New Model

See `web-app/docs/MODELS.md`. Summary: add metadata to `providers.ts` `AVAILABLE_MODELS`, add a "UI id → gateway upstream alias" entry to `UPSTREAM_MODEL_NAME` in `server.ts`, update `.env.example`. Do **not** add provider types or `createModel` case branches.

## Debug LLM Calls

Send header `x-chat-debug: 1` or set `CHAT_DEBUG=1` env var to get server-side request/response logs including which model was routed.
