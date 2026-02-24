# ForgeCV — Engineering Log

> Real friction points hit during the build. Not what the docs say should happen — what *actually* happened.

---

### Hurdle #1 — `wrangler.jsonc` Trailing Comma (2026-02-22)

**The Conflict:** After manually adding the `ai`, `d1_databases`, and `r2_buckets` bindings to `wrangler.jsonc`, running `npm run cf-typegen` threw a `CommaExpected` parse error on the `"ai"` key.

**The Pivot:** The issue was that the scaffolded `"observability"` block had no trailing comma before our new bindings. JSON (even JSONC) requires commas between sibling keys — the scaffolder left the file in a state where appending new keys broke it silently.

**The Lesson:** Always check the closing brace of the last scaffolded key in `wrangler.jsonc` before appending new bindings. The Wrangler CLI gives a precise line number but the error message (`CommaExpected`) doesn't make it obvious it's a missing comma *before* your new code, not inside it.

---

### Hurdle #2 — R2 Bucket Creation Blocked (2026-02-22)

**The Conflict:** Running `npx wrangler r2 bucket create forgecv-resumes` failed with `[code: 10042] — Please enable R2 through the Cloudflare Dashboard`.

**The Pivot:** R2 requires a one-time manual opt-in from the Cloudflare Dashboard even though the account already has Workers and D1 active. It's not enabled by default.

**The Lesson:** Cloudflare's products are independently gated. D1 and Workers AI activate automatically on new accounts, but R2 requires explicit enablement. Add this step to any Cloudflare project setup checklist before running CLI provisioning commands.

---

### Hurdle #3 — v0 Generated a Self-Contained Project Inside `src/` (2026-02-22)

**The Conflict:** After generating the UI with Vercel's v0 and copying the output into the `src/` directory, the project had two conflicting config stacks: the Cloudflare-native one at the root (`next.config.ts`, `wrangler.jsonc`, `package.json` with `@opennextjs/cloudflare`) and a plain Next.js one inside `src/` (`src/package.json`, `src/next.config.mjs`, `src/tsconfig.json`, `src/styles/globals.css`, `src/pnpm-lock.yaml`). The `src/styles/globals.css` was a light-theme file that conflicted with the dark theme in `src/app/globals.css`.

**The Pivot:** Deleted all misplaced config files from `src/`. Moved `src/components.json` to the project root. Merged the 30+ missing Radix UI and utility dependencies from `src/package.json` into the real root `package.json` and reinstalled. Kept only `src/app/globals.css` (the dark, Cloudflare-orange theme).

**The Lesson:** v0 generates standalone Next.js projects — it has no concept of your existing project structure. When copying v0 output into an existing repo, only take the `src/app` and `src/components` directories. Never let it overwrite config files at the root.

---

### Hurdle #4 — `unpdf` WASM Crash in Workers Bundle (2026-02-22)

**The Conflict:** The initial plan was to parse PDF bytes server-side in the `/api/upload` Worker using `unpdf`, a library advertised as WASM-compatible. When running `npm run preview`, every `POST /api/upload` returned a `500` with:
```
TypeError: Cannot read properties of undefined (reading 'default')
at interopDefault
```
The stack trace pointed to the OpenNext bundler's `interopDefault` function — meaning the module itself resolved to `undefined` at runtime.

**The Pivot:** `unpdf` bundles a PDF.js WASM worker binary. When OpenNext compiles the route for the Cloudflare Workers bundle, it can't resolve the WASM file path, so the module comes through as `undefined`. Even with the `nodejs_compat` flag, WASM files need to be explicitly declared in `wrangler.toml` or served from a known path — the bundler won't auto-package them.

The fix was an architectural shift: **move PDF extraction to the browser**. `pdfjs-dist` running in Chrome/Firefox has full WASM support natively. The browser extracts the text, sends it as a plain string to `/api/parse`, and the Worker only does LLM inference — which is what it's good at. The `/api/upload` route became a clean, simple R2 write with no parsing logic at all.

**The Lesson:** In a Cloudflare Workers environment, any library that bundles WASM is a risk unless you explicitly configure the WASM binding in `wrangler.toml`. For anything browser-native (PDF rendering, image manipulation), push it to the client and let the Worker handle only data transformation. This is both a correctness fix and a performance win — Workers stay lean, browsers handle the heavy lifting.

---

### Hurdle #5 — PDF Extraction Felt Slow (2026-02-22)

**The Conflict:** The first PDF drop was noticeably sluggish. The UI would sit on "Extracting text..." for several seconds before the AI call even started. The bottleneck had two layers: (1) `pdfjs-dist` being dynamically imported (`await import("pdfjs-dist")`) on first use, and (2) the PDF.js web worker being fetched from `cdnjs.cloudflare.com` on every cold load.

**The Pivot:** Two fixes in parallel:
1. Copied `pdf.worker.min.mjs` from `node_modules/pdfjs-dist/build/` into `/public/` and pointed `GlobalWorkerOptions.workerSrc` to `/pdf.worker.min.mjs`. This turns an external CDN fetch into a local static asset served from Cloudflare's edge cache.
2. Added a `useEffect` in the dropzone component that fires `import("pdfjs-dist")` on mount (discarding the result). This warms the module cache so the actual drop handler hits an already-resolved import.

Additionally, the `/api/parse` route was using `llama-3.3-70b` for what is essentially a JSON schema extraction task. Switched to `@cf/meta/llama-3.2-3b-instruct`, which is ~4x faster for structured output and more than sufficient for this use case. The 70B model is reserved for `/api/tailor`, where deep reasoning matters.

**The Lesson:** Dynamic imports in client components are expensive on first use. For any library you know will be needed (especially heavy ones like pdfjs), preload it on mount. Also: match model size to task complexity. Using a 70B model for "turn this text into JSON" is like using a freight truck to deliver a letter — the 3B model does it faster and the output quality is identical for structured extraction.

---

### Hurdle #6 — Schema Migration: Flat `skills: string[]` → Categorized `SkillCategory[]` (2026-02-23)

**The Conflict:** The original schema had `skills: string[]` — a flat list like `["TypeScript", "Go", "Docker"]`. This worked for rendering but failed for ATS tailoring, where the prompt needs to know *which category* a skill belongs to. We needed `skills: SkillCategory[]`. The problem: sessions already persisted in localStorage under the old schema. Any existing data would silently break on load.

**The Pivot:** Added `migrateSkills(raw: unknown): SkillCategory[]` in `resume-types.ts`. It detects the old format at runtime (`typeof raw[0] === "string"`) and wraps it into a single `"Skills"` category, or validates and normalizes the new format. This runs inside `migrateResumeData`, which is called on every session load and every API response — no data is ever silently dropped.

**The Lesson:** When you change a core schema type in an app with localStorage persistence, write the migration function *before* shipping the change. The safest pattern: every load goes through a migration layer so old sessions degrade gracefully instead of crashing the UI.

---

### Hurdle #7 — Workers AI: `.response.trim()` TypeError on Non-String Output (2026-02-23)

**The Conflict:** After a successful tailoring run, a subsequent call to `POST /api/tailor` would crash with:
```
TypeError: (intermediate value).response.trim is not a function
```
All three routes did `(response as { response: string }).response.trim()` — a hard cast with no defensive check. Under normal conditions Workers AI returns `{ response: string }`. But when the model times out or hits a context-length limit, `.response` can be `undefined`, or the return value can be a `ReadableStream` (the streaming variant of the same binding).

**The Pivot:** Replaced the hard cast with a type-safe guard across all three routes:
```typescript
const aiText = (response as { response?: string | null }).response;
if (typeof aiText !== "string" || !aiText) {
  return NextResponse.json({ error: "Workers AI returned empty response" }, { status: 500 });
}
const raw = aiText.trim();
```
The chat route returns a graceful user-facing message instead of a 500, since the user is actively waiting for a reply.

**The Lesson:** Never trust the shape of a Workers AI response without a runtime check. The TypeScript types for `env.AI.run()` reflect the *happy path* — they don't encode the edge cases. Defensive type narrowing at the API boundary is non-negotiable.

---

### Hurdle #8 — Tailor Prompt: LLM Ignored Within-Array Entry Order (2026-02-23)

**The Conflict:** When tailoring for a game development role, the LLM returned a resume where the most recent backend engineering role was still listed first in the `experience` array — even though game dev experience existed in the data. The prompt said "Lead with the most impactful section" but said nothing about *item order within* an array. The LLM defaulted to preserving chronological order. Additionally, a position titled "Game Developer" was being parsed as the generic "Software Developer" — the parser was paraphrasing instead of copying verbatim.

**The Pivot:** Added an explicit "Within-Array Reordering" instruction block to the tailor prompt: *"Do NOT assume the most recent entry is most relevant. If the JD is for game development, put game dev roles first — even if they are older. Apply this domain-first logic across every domain."* Added a matching parse rule: *"Copy the EXACT job title/role as written — do not paraphrase or generalize."*

**The Lesson:** LLMs have strong priors. "Most recent first" is such an ingrained resume convention that the model will follow it unless you explicitly override it. And "clean up" instincts cause models to normalize titles they consider informal. Every assumption you hold as a human must be spelled out in the prompt — the model responds to what you *said*, not what you *meant*.

---

### Hurdle #9 — `@opennextjs/cloudflare` Version Mismatch: Global vs. Local Binary (2026-02-23)

**The Conflict:** Running `npm run preview` threw:
```
Error: Could not resolve "server-only"
  node_modules/@opennextjs/cloudflare/dist/api/chunk-VTBEIZPQ.mjs:2:7
```
The error came from `/opt/homebrew/lib/node_modules/@opennextjs/cloudflare` — a **globally installed** Homebrew version, not the local project one. The package.json had `"@opennextjs/cloudflare": "^0.2.1"` pinned, but `npm install` had never succeeded for that version because it requires `wrangler@^3.78.10` while the project uses `wrangler@^4.67.0`. The peer conflict silently prevented local installation. npm then found no binary in `node_modules/.bin/` and fell back to the global Homebrew one.

The global v1.x binary tried to bundle `server-only` (a Next.js internal package) but couldn't find it at its own global node_modules path — only the project-local `node_modules` has it.

**The Pivot:** Two-step fix:
1. Updated `package.json` to `"@opennextjs/cloudflare": "^1.17.0"` — the actual version the config files were already written against (`defineCloudflareConfig`, `initOpenNextCloudflareForDev` are v1.x APIs).
2. Ran `npm install` successfully — the v1.17.0 package correctly declares `wrangler@^4.65.0` as its peer, matching the project's `wrangler@^4.67.0`.

The local binary at `node_modules/.bin/opennextjs-cloudflare` now exists and npm scripts use it instead of the global fallback.

**The Lesson:** When `npm install` fails silently due to a peer conflict, the shell's `PATH` fallback to a globally installed binary can mask the real problem for a long time — especially if the global and local versions share the same binary name. Always verify `node_modules/.bin/<binary>` exists after a fresh install. Keep the version in `package.json` matched to the APIs your config files actually use; the TypeScript errors (`no exported member 'defineCloudflareConfig'`) were pointing directly at this mismatch and should have been caught earlier.

---

### Hurdle #10 — Canvas Rewrite: Static Layout → `sectionOrder`-Driven Dynamic Rendering (2026-02-23)

**The Conflict:** The original `ResumeCanvas` rendered sections in a fixed order hardcoded in JSX: Summary → Experience → Skills → Education. This was fine for the MVP but broke the moment we needed the AI to control section priority — the tailoring agent returns a `sectionOrder` array that tells the UI what to show and in what sequence. There was no mechanism to dynamically render sections from that array, handle the 4 new section types (Projects, Certifications, Awards, Publications), or let users add/remove/reorder sections manually.

**The Pivot:** Rewrote the canvas to map over `resume.sectionOrder` for both preview and edit modes. Each section key dispatches to a `previewSection(key)` or `editSection(key, idx)` function. Every section gets per-entry controls (move up/down/remove). An "Add section" row at the bottom shows only the sections not yet in `sectionOrder`. The `SectionKey` union type enforces that only valid section names enter the array.

**The Lesson:** If the LLM controls the structure of the output (section order, which sections to include), the UI *must* be driven by that same data — not a parallel hardcoded layout. Any disconnect between the AI's output schema and the renderer will surface as a silent no-op: the AI says "put Projects first" but the UI ignores it and renders Education first anyway.

---

### Hurdle #11 — `buildPrintHtml` Silently Broken After Schema Change (2026-02-23)

**The Conflict:** After the `skills: string[]` → `skills: SkillCategory[]` schema migration, the PDF export appeared to work (no runtime error in the browser) but produced garbage output. The `buildPrintHtml` function in `workspace-header.tsx` still called `skills.join(", ")` — which silently called `.join()` on an array of objects, producing `[object Object], [object Object], ...` in the exported PDF. Additionally, the function only handled 4 sections (Summary, Experience, Skills, Education) and ignored `sectionOrder` entirely.

**The Pivot:** Complete rewrite of `buildPrintHtml`. It now:
- Iterates `resume.sectionOrder` to render sections in the correct order
- Handles all 8 section types with template-specific markup
- Renders `SkillCategory[]` as `<strong>Category Label:</strong> skill1, skill2, ...` lines
- Uses an `esc()` helper to HTML-escape all user content before injection
- Substitutes `{{ACCENT}}` placeholders in the template's `printCss` string with the live accent color

**The Lesson:** When you change a shared data type, every downstream consumer needs to be audited — not just the primary renderer. `buildPrintHtml` was a separate code path that produced HTML strings and wasn't type-checked against the live canvas. The safest pattern is to make both paths share the same rendering logic, or at minimum add a TypeScript type assertion that fails at compile time when the schema changes.

---

### Hurdle #12 — Template System Redesign: 7 Generic → 3 Opinionated + Live Accent Color (2026-02-23)

**The Conflict:** The original 7 templates (Standard, Modern, New Grad, Senior, Technical, Academia, Creative) were all variations on the same layout with different font/color choices. None matched real-world resume standards that recruiters actually recognize. More importantly, the `ResumeTemplate` interface had no way to express whether a template supports a user-chosen accent color — there was no `textColor`, `supportsAccent`, or `defaultAccent` field.

**The Pivot:** Collapsed to 3 templates with real specifications:
- **Harvard** — Calibri, centered header, hairline `border-top` above each section heading
- **Rezi** — Georgia serif, dark navy `#1a1a2e` name/headings, ALL CAPS + `border-bottom: 0.75pt solid #c8c8c8`, middle-dot `·` bullets via `li::before { content: '·' }`
- **Rezi+** — Same as Rezi but with `supportsAccent: true` and `{{ACCENT}}` placeholders in `printCss` for name and role title color

Added `accentColor: string` as a session-persisted SWR key (`forge-accent`) in the store. The color picker in the workspace header is a hidden `<input type="color">` triggered by clicking a color swatch button — the swatch only renders when `template.supportsAccent` is true. The canvas preview applies `accentColor` inline to the name `<h1>` when `template.supportsAccent` is set.

**The Lesson:** Template systems need to encode their own capabilities, not just their aesthetics. A template that supports a user-controlled accent color is fundamentally different from one that doesn't — that distinction must live in the template interface, not in the component that renders it. `supportsAccent: boolean` in the interface makes the color picker conditional on data rather than on a fragile `templateId === "rezi-colored"` string comparison.

---

### Hurdle #13 — TypeScript: `.filter(Boolean)` Does Not Narrow `(string | undefined)[]` to `string[]` (2026-02-23)

**The Conflict:** In `buildPrintHtml`, after building the array `[e.company, e.location, e.dates]` (typed as `(string | undefined)[]`), calling `.filter(Boolean).map(esc)` threw a TypeScript build error:
```
Type '(s: string) => string' is not assignable to parameter of type
'(value: string | undefined, ...) => string'.
Type 'undefined' is not assignable to type 'string'.
```
TypeScript's `.filter(Boolean)` overload doesn't narrow the element type — the result is still `(string | undefined)[]` because the type system can't prove the callback eliminates all undefined values.

**The Pivot:** Replaced `.filter(Boolean)` with a type predicate:
```typescript
.filter((x): x is string => Boolean(x))
```
This explicitly tells TypeScript that the callback guarantees `string` elements, allowing `.map(esc)` to compile.

**The Lesson:** `Array.prototype.filter(Boolean)` is a JavaScript idiom that TypeScript doesn't model precisely. Whenever you need the type-narrowed result of a truthiness filter, use a type predicate `(x): x is T => Boolean(x)`. This is a frequent gotcha when working with optional fields from database or API responses.

---

### Hurdle #14 — `InlineEdit` Component Missing `style` Prop Blocked Accent Color in Edit Mode (2026-02-23)

**The Conflict:** To apply `nameColor` (the accent color for Rezi+) to the name field in edit mode, we needed to pass `style={{ color: nameColor }}` to the `InlineEdit` component. TypeScript rejected it:
```
Property 'style' does not exist on type 'IntrinsicAttributes & InlineEditProps'.
```
`InlineEdit` was typed with a minimal prop set — `className`, `placeholder`, `highlighted`, `multiline` — and didn't forward `style` to the underlying `<input>` or `<textarea>`.

**The Pivot:** Added `style?: CSSProperties` to `InlineEditProps` and passed it through to both the `<input>` and `<textarea>` elements. One-line change per element; no functional impact on existing usages.

**The Lesson:** Shared UI primitives that wrap native elements should accept and forward `style` and `className` from day one. The cost of adding them upfront is zero; the cost of patching them later is a cascade of TypeScript errors across every call site that tried to use them.

---

### Hurdle #15 — Profile Panel Showed Stale State After Upload (2026-02-23)

**The Conflict:** The "Saved Profile" section in the My Profile panel showed "No profile saved yet" even after a successful PDF upload and parse. The user confirmed the resume was parsed and loaded into the canvas — but the panel was empty. The `ProfilePanel` component called `refreshMaster()` (which reads from localStorage) only once, in a `useEffect` with no deps. If the collapsible was already open when the upload completed, the panel never re-read localStorage after the save. If it was closed and then opened after the upload, same result — the `onOpenChange` just set `isOpen` state, it didn't re-fetch.

**The Pivot:** Changed `onOpenChange={setIsOpen}` to `onOpenChange={(open) => { setIsOpen(open); if (open) refreshMaster() }}`. Now every time the panel is opened, it re-reads the master profile from localStorage. Zero extra network calls, zero performance cost — just a `localStorage.getItem` on toggle.

**The Lesson:** Any component that reads from a persistent store (localStorage, IndexedDB, a global singleton) and is conditionally rendered or collapsible needs to refresh its local state on show. A `useEffect` on mount is not enough when the component stays mounted but hidden. Read on open, not just on mount.

---

### Hurdle #16 — Parse Route Returning Empty Response From 70B Model (2026-02-23)

**The Conflict:** After adding the defensive `typeof aiText !== "string" || !aiText` guard, the parse route returned `{ "error": "Workers AI returned empty or non-text response" }` — the guard was working, but the root cause was still present. The parse route was still using `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, which had been documented back in Hurdle #5 as too slow for the parse task. Under any meaningful load (or on a cold Workers AI GPU instance), the 70B model would silently return an empty or null `.response` for what is a JSON extraction task.

**The Pivot:** Switched the parse route back to `@cf/meta/llama-3.2-3b-instruct` as originally documented. The 70B model was accidentally re-used during a refactor of the parse prompt; the model ID was never updated. The 3B model handles structured JSON extraction with identical output quality and is ~4x faster — this is exactly the model-task fit analysis documented in Hurdle #5.

**The Lesson:** When you refactor a prompt or route, audit all of the route's configuration — not just the prompt text. A model ID is as much a part of the route's behavior as the system prompt. Adding it as a named constant (`PARSE_MODEL = "@cf/meta/llama-3.2-3b-instruct"`) at the top of the file makes the intent explicit and prevents silent regressions.

---

### Hurdle #17 — Light Mode: CSS Variable Overrides vs. Tailwind `dark:` Variant Architecture (2026-02-23)

**The Conflict:** Adding a light/dark mode toggle required understanding how Tailwind CSS v4's `@custom-variant dark (&:is(.dark *))` interacts with `next-themes`. The app's entire color system lives in CSS custom properties on `:root` — not in `dark:` Tailwind utility classes. This meant the standard advice of "add dark variants everywhere" was irrelevant. The problem was purely about making CSS variables swap when next-themes adds `class="light"` to the `html` element.

**The Pivot:** Three-part approach:
1. Kept `:root` as the dark theme (the app's design-first assumption). No changes to existing colors.
2. Added `html.light { ... }` with light-mode CSS variable overrides — only overriding the variables, not touching any component JSX.
3. Wrapped the app in `<ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>` (a thin `"use client"` wrapper around `next-themes`). Added `suppressHydrationWarning` to `<html>` to prevent React's hydration mismatch warning when next-themes sets the class before the client JS runs.

The entire light mode required zero changes to any component — only the CSS variable layer changed. This is the power of a token-based design system.

**The Lesson:** In a CSS-variable-driven design system, theming is a CSS problem, not a component problem. If you build your component library on CSS custom properties (not hardcoded colors), a full theme swap is just a variable override block. Resist the urge to add `dark:bg-gray-900` to individual components — that leads to hundreds of change sites. One `html.light {}` block in globals.css is the entire theme implementation.

---

### Hurdle #18 — Tailor Chained Previous Sessions Instead of Starting from Master (2026-02-24)

**The Conflict:** When a user tailored their resume for a cybersecurity role, the canvas was updated with a cyber-focused version. When they then pasted a software engineering JD and clicked "Tailor for JD" again, the AI received the *already-cyber-tailored canvas state* as its base — not the original master profile. The result was a resume that kept cybersecurity framing even after the second tailor. Each tailoring session was compounding the previous one, drifting further from the source of truth.

**The Pivot:** In `jd-panel.tsx`, changed the body of the tailor request from `{ resume, jobDescription, masterProfile }` to `{ resume: masterProfile ?? resume, jobDescription, masterProfile }`. The master profile — the parsed, unedited full career history — is now always used as the starting point. The canvas state (`resume`) is a "working copy", not the source. If no master profile exists the canvas state is the correct fallback.

**The Lesson:** A "tailor" operation is not an edit on the current canvas — it's a fresh selection and transformation from the complete career history. Once you model the canvas as a working copy and the master profile as the source of truth, the correct data flow becomes obvious. Any system that chains AI operations without resetting to the source will compound errors with each iteration.

---

### Hurdle #19 — Prompt Engineering: LLM Preserved Source Wording and Miscalculated Experience Years (2026-02-24)

**The Conflict:** Two persistent issues in the tailor output:

1. The LLM was copying bullet points near-verbatim instead of rewriting them. The original prompt said "You MAY reword and improve clarity" — a passive permission, not a mandate. The model defaulted to its safe prior of preserving the user's wording.

2. The summary kept stating a wrong number of years of experience. The model was counting education years, project dates, or overlapping concurrent roles by summing their individual durations instead of counting unique calendar time.

**The Pivot:** Two targeted prompt changes:
1. Added an explicit `BULLET REWRITING (MANDATORY)` section with a banned-phrases list ("Worked on", "Helped with", "Was responsible for", etc.) and the rule: "Copying a bullet verbatim from the source is a failure."
2. Added a `YEARS OF EXPERIENCE (Summary rule)` section: "Calculate ONLY from the experience array (paid positions). If dates overlap between concurrent jobs, count unique calendar years — NOT the arithmetic sum." With a worked example: "Job A 2021–2023 + Job B 2022–2024 = 3 years (2021→2024), NOT 4."

Also relabeled the user message from "RESUME" to "CANDIDATE FULL CAREER HISTORY" to signal to the model that this is the complete master dataset to select from.

**The Lesson:** LLMs are powerful default priors. "You may reword" is not an instruction to reword — it's an invitation to preserve. Every behavioral requirement needs to be a mandate with explicit failure conditions. For calculations (dates, counts, metrics), always provide a worked example in the prompt; the model follows the pattern rather than reason from scratch.

---

### Hurdle #20 — `prompt()` Dialogs Blocked for Skill Editing; Add-Bullet Button Invisible (2026-02-24)

**The Conflict:** Adding skills to a category and adding new skill categories both used `window.prompt()` — native browser dialog boxes. These are blocked in some deployment environments, iframes, and browser security configurations. Even when not blocked, a gray OS dialog in the middle of a polished dark UI breaks the design. Separately, the "+ add bullet" buttons for experience and project entries were styled `text-muted-foreground/40` (near-invisible faint text), making them effectively undiscoverable.

**The Pivot:** Two changes:
1. Replaced both `prompt()` calls with inline controlled inputs. When the user clicks "+ add category" or "+ add" in a skill category, the button is replaced in-place with a focused `<input>`. `Enter` commits, `Escape` cancels, `onBlur` commits if non-empty. State is managed with `useState` in the canvas component.
2. Restyled `+ add bullet` buttons to use the same dashed-border pill style (`border border-dashed border-border px-2 py-0.5`) as every other "add" button in the app.

**The Lesson:** `window.prompt()` is a trap — it works in local testing but fails in production environments (Cloudflare deployment, CSP headers, sandboxed iframes). And invisible UI is broken UI. Both issues share the same root: interactive affordances that weren't held to the same visual and functional standard as the rest of the design system.

---

### Hurdle #21 — LLM Preamble Text Breaking JSON Parsing; Model Adds Bullet Hyphens in Skill Values (2026-02-24)

**The Conflict:** Two related failure modes in the tailor route that both broke `JSON.parse()`:

1. The 70B model kept producing a preamble sentence before the JSON block despite the "Return ONLY this JSON" instruction: `"To tailor the resume for the Software Engineer Intern role at Cloudflare, I will select and tailor... ```json\n{...}\n```"`. The previous extractor used `raw.startsWith("```")` — which is false when prose precedes the fence — so the raw string (with preamble + fences) was handed directly to `JSON.parse()`, causing a SyntaxError every time.

2. The model also introduced malformed skill values: `["- Python", "- Go", "- TypeScript"]` instead of `["Python", "Go", "TypeScript"]` — treating the skills array as a markdown list and adding "- " prefixes to each string. Combined with duplicate skills appearing across multiple categories (same skill listed under both "Languages" and "Tools"), the tailored output would render with bullet dashes baked into the skill tags.

**The Pivot:** Three changes applied together:

1. **Robust JSON extractor** (replacing the fragile `startsWith` check): First tries to match a ` ```json ... ``` ` fence block *anywhere* in the response via regex. If no fence is found and the response doesn't start with `{`, falls back to slicing from the first `{` to the last `}`. This handles all three model output styles: bare JSON, fenced JSON, and prose-then-fenced-JSON.

2. **Skills post-processing**: After parsing, strips any `"- "`, `"• "`, or `"* "` prefix from every skill string and deduplicates across categories using a case-insensitive `Set`. Categories that end up empty after dedup are removed.

3. **Stronger prompt instruction**: Added a clearly marked `⚠️ OUTPUT FORMAT — ABSOLUTE REQUIREMENT` block at the top of the system prompt with explicit rules: response must start with `{` and end with `}`, no markdown fences, no preamble. Also added domain focus instructions (frontend JD → lead with frontend, backend JD → lead with backend) and reinforced the skill format rule: "skill strings must be plain text — NO hyphens, bullet characters, or '- ' prefixes."

**The Lesson:** Never trust a model's stated output format. "Return ONLY this JSON" is aspirational — the model will still narrate its reasoning if that's its default behavior. The correct architecture is: (1) make the instruction as explicit as possible in the prompt, AND (2) write a fault-tolerant extractor that survives the model's actual behavior. The prompt fixes false positives; the extractor handles the inevitable outliers. Post-processing for known model quirks (like markdown list prefixes in array values) is non-optional.

---

### A Note for Recruiters

I built this project to demonstrate proficiency with **Edge Computing** and **LLM Orchestration** on the Cloudflare stack. The Engineering Log above is the honest version of the build — not the polished post-mortem, but the real decisions made in the trench.
