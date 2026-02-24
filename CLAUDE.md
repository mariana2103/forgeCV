# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**ForgeCV** — an edge-native AI resume tailoring engine. Users upload a resume (PDF or text), an LLM structures it into JSON, they paste a Job Description, and a second LLM tailors the resume with full agent reasoning. Everything runs on the Cloudflare stack.

App lives in `cf-ai-forge-cv/`. All source code is under `cf-ai-forge-cv/src/`.

## Stack (current, accurate)

| Layer | Technology |
|---|---|
| Framework | Next.js 16, App Router, via `@opennextjs/cloudflare@^1.17.0` |
| Runtime | Cloudflare Workers (V8 Isolates) |
| AI — Parsing | `@cf/meta/llama-3.2-3b-instruct` via `env.AI.run(...)` |
| AI — Tailoring | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` via `env.AI.run(...)` |
| Database | Cloudflare D1 via `env.DB` |
| Storage | Cloudflare R2 via `env.BUCKET` |
| PDF extraction | `pdfjs-dist` (browser-side only) |
| UI | Tailwind CSS v4 + Shadcn UI, dark-first CSS variables |

## Hard Constraints

- **No Node.js APIs.** Workers run on V8 Isolates. No `fs`, `path`, `crypto` (Node), `child_process`, etc. Use Web Standards: `fetch`, `ReadableStream`, `crypto` (Web Crypto API).
- **No WASM in Workers** unless explicitly declared in `wrangler.jsonc`. PDF parsing was moved to the browser for exactly this reason.
- **Workers AI binding** — always `env.AI.run(model, { messages, max_tokens })`. Never a direct HTTP call to an AI API.
- **D1 binding** — `env.DB.prepare(sql).run()` / `.all()` / `.first()`. No connection strings.
- **R2 binding** — `env.BUCKET.put(key, body)` / `.get(key)`. No S3 SDK.
- **Edge-compatible packages only.** Verify any new npm package runs in the Workers runtime before adding it.

## Architecture Decisions

**Master Profile vs. Canvas state:** The master profile (stored in localStorage under `forgecv-master-profile`) is the source of truth — the full unmodified career history. The canvas is a working copy. Every tailor call sends `masterProfile ?? resume` as the base, never the already-tailored canvas state. Chaining tailor sessions compounds errors.

**Model split:** 3B model for parsing (fast, structured JSON extraction). 70B model for tailoring (needs reasoning depth). Do not swap these.

**JSON extraction from LLM output:** Both `/api/parse` and `/api/tailor` use a three-strategy extractor — fence match → brace slice → raw fallback — because the models sometimes add preamble text or markdown fences despite prompt instructions.

**Skills schema:** `skills: SkillCategory[]` where each `SkillCategory = { id, label, skills: string[] }`. Never a flat `string[]`. The `migrateResumeData` function handles legacy data. Skill strings are plain text — no hyphens or bullet prefixes.

**Session persistence:** SWR in-memory store + 7-day localStorage TTL (`forgecv-session-v2`). Master profile stored separately (`forgecv-master-profile`). Both managed in `resume-store.tsx` and `master-profile.ts`.

**Theming:** Dark-first CSS variables on `:root`. Light mode is `html.light { ... }` overrides in `globals.css`. Zero `dark:` Tailwind variants — theming is a CSS problem, not a component problem.

## Documentation Protocol

After every significant feature or bug fix, add a hurdle entry to `docs/ENGINEERING_LOG.md`.

Each entry follows this structure:
- **The Conflict** — what didn't work and why
- **The Pivot** — what was changed and why that approach
- **The Lesson** — the generalizable takeaway (especially Cloudflare-specific constraints)

Tone: professional, in-the-trenches. A senior dev explaining decisions to a peer, not a polished post-mortem.
