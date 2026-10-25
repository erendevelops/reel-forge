# Plan 2 of 4: App Shell, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local Next.js app that runs at localhost and provides:
- the project workspace on disk;
- a runner that drives the user's `claude` CLI as an agent with live progress;
- a Setup page that checks every dependency;
- TR/EN and erens.website's light theme;
- Projects / New project screens;
- a render job that turns a project version into MP4s through the Plan 1 core, with draft and final speed profiles.

**Architecture:**
- Same repo as Plan 1; Next.js App Router is added at the root. The Plan 1 `lib/` stays as is.
- Server-only modules in `lib/app/` wrap the filesystem workspace, the Claude CLI and the render core.
- The UI talks to API routes guarded against cross-site and DNS-rebinding requests (ported from marketiyo).
- Long work (Claude runs, renders) runs as jobs. Their events are appended to a JSONL file and streamed to the browser over Server-Sent Events.

**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind CSS 4, zod 3, vitest 2 + @testing-library/react + jsdom · Plan 1 core (`lib/plan`, `lib/compile`, `lib/render`, `lib/media`).

**Spec:** `docs/superpowers/specs/2026-10-24-ai-video-editor-design.md` (§2, §5, §7, §8, §11). Reference implementation for patterns: `github.com/erendevelops/marketiyo`, files `lib/providers/claude-code.ts`, `lib/workspace/{store,queue}.ts`, `lib/server/request-guard.ts`, `lib/i18n/*`.

**Out of scope (Plan 4):** option cards, transcript check, storyboard workspace, direct edits, review screen. **Out of scope (Plan 3):** skills and the prompts Claude runs.

## Global Constraints

- Local only. There's no login, no cloud and no database; all state is plain files under `workspace/` at the repo root (gitignored).
- Claude runs through the installed `claude` CLI using the user's subscription login. The app never calls Anthropic directly and never asks for an API key.
- Windows 10/11 and macOS. Paths contain non-ASCII characters (`Masaüstü`). Always use `spawn(cmd, argsArray)`; only the Windows `claude.cmd` lookup may use `shell: true`, exactly as marketiyo does. Kill process trees on Windows with `taskkill /pid <pid> /T /F`.
- UI language TR or EN, chosen in the top bar. Every user-facing string lives in `lib/i18n/{tr,en}.ts`, with Turkish as the default.
- Theme, light only:
  - colours: background `#F7FBF9` with no dot pattern; ink `#111827`; muted `#6B7280`; lines `#E8ECEA`; brand `#3ECF8E` / `#1F9D6E`; soft `#F1F5F3`;
  - green top bar `rgba(31,157,110,.94)`;
  - fonts: Silkscreen for headings, JetBrains Mono for labels/buttons/meta, Nunito for body;
  - white cards with 14–18 px radius;
  - no dark mode, no macOS window-button decorations, no crowded cards. Airy spacing per the approved mockup `docs/superpowers/specs/mockups/storyboard-and-option-cards.html`.
- Render speed is a goal. The **draft** profile is for previews and iteration; **final** is the only path to deliverables. Ratios render in parallel, bounded by CPU count.
- Every API route that changes state passes the request guard.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **`claude` not installed, or installed but logged out.** Setup shows which, with the TR/EN fix hint, and no run starts. → Task 4, `availability classifies missing / logged-out / ok`.
2. **The Claude usage limit hit mid-run** (seen in this project: "You've hit your session limit · resets 2pm"). The job ends as `paused-limit` with the reset text. Partial files stay, and "Resume" continues the same session. → Task 4, `classifies rate limit with reset text`; Task 5, `paused job resumes with --resume`.
3. **The browser closes while a job runs.** The job keeps going, and reopening the project replays its events from the JSONL. → Task 5, `late subscriber receives replayed events`.
4. **Two requests writing the same project at once.** Writes never interleave or corrupt `project.json`. → Task 3, `concurrent updates serialise`.
5. **Input folders with Turkish characters and spaces** (`Masaüstü/İçerik çekimleri`). Creating a project copies them intact. → Task 3, `imports inputs from a unicode path`.

---

### Task 1: Next.js scaffold, theme, i18n, top bar

**Files:**
- Modify: `package.json` (add `next@^15`, `react@^19`, `react-dom@^19`, `server-only`, `tailwindcss@^4`, `@tailwindcss/postcss`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`; scripts `dev: next dev`, `build: next build`, `start: next start`), `tsconfig.json` (Next settings + `@/*` path alias to repo root), `vitest.config.ts` (`environmentMatchGlobs: [['tests/ui/**', 'jsdom']]`), `.gitignore` (`.next/`, `workspace/`)
- Create: `next.config.ts`, `postcss.config.mjs`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx` (redirects to `/projects`), `components/TopBar.tsx`, `components/LanguageSwitch.tsx`, `lib/i18n/{index,tr,en}.ts`, `lib/app/settings.ts`
- Test: `tests/ui/topbar.test.tsx`, `tests/app/i18n.test.ts`

**Interfaces:**
- Produces:
  - `type Language = 'tr' | 'en'`
  - `t(lang: Language): Dictionary`. `Dictionary` is the type of `tr`, and `en` must satisfy it exactly (compile-time key parity).
  - `getSettings(): Promise<{ language: Language; claudeBinary: string }>` and `saveSettings(patch)` in `lib/app/settings.ts`. Stored in `workspace/settings.json`; defaults `{ language: 'tr', claudeBinary: 'claude' }`.
  - CSS custom properties in `app/globals.css`: `--bg --ink --muted --line --brand --brand-d --soft` with the Global Constraints values, and font families `--font-px` (Silkscreen), `--font-mono` (JetBrains Mono), `--font-body` (Nunito) loaded with `next/font/google`.

- [ ] **Step 1: Write the failing tests.**
  - `tests/app/i18n.test.ts > en has every tr key`: deep key sets of `tr` and `en` are equal.
  - `tests/ui/topbar.test.tsx > renders brand and language switch`: render `<TopBar lang="tr" />`. Text `REELFORGE` is present. A `TR / EN` switch exists, with `TR` marked `aria-current`. Clicking `EN` calls the `onChange('en')` prop.
- [ ] **Step 2: Run** `npx vitest run tests/app/i18n.test.ts tests/ui` → FAIL.
- [ ] **Step 3: Implement** the scaffold, tokens, fonts, `TopBar` (green bar, logo tile, Silkscreen name, language switch, right-side slot) and dictionaries. The top bar matches the approved mockup's v2 header.
- [ ] **Step 4: Run** the tests, then `npx next build`. Both PASS, and the build succeeds.
- [ ] **Step 5: Commit** `feat(app): next.js scaffold, theme tokens, TR/EN, top bar`.

### Task 2: Request guard

**Files:**
- Create: `lib/app/request-guard.ts`, `middleware.ts` (applies the guard to `/api/*`)
- Test: `tests/app/request-guard.test.ts`

**Interfaces:**
- Produces:
  - `rejectReason(input: { method: string; host: string | null; origin: string | null; secFetchSite: string | null; allowedHosts?: string[] }, lang: Language): string | null`.
  - Port marketiyo's `lib/server/request-guard.ts` logic exactly:
    - accept loopback names, `*.localhost` and IP literals, plus `REELFORGE_ALLOWED_HOSTS`;
    - refuse `sec-fetch-site` `cross-site`/`same-site`;
    - for unsafe methods, the Origin host must equal the Host.

    Messages come from i18n.

- [ ] **Step 1: Write the failing tests:**
  - `allows localhost POST with matching origin`;
  - `rejects foreign host` (`evil.com`);
  - `rejects rebinding host` (`rebind.example` resolving to loopback: host not local → reject);
  - `rejects cross-site fetch`;
  - `rejects mismatched origin on POST`;
  - `allows GET without origin`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `rejectReason` and the middleware (403 JSON `{ error }`).
- [ ] **Step 4: Run** → PASS. **Commit** `feat(app): request guard for API routes`.

### Task 3: Project workspace store

**Files:**
- Create: `lib/app/workspace/paths.ts`, `lib/app/workspace/store.ts`, `lib/app/workspace/queue.ts`, `lib/app/workspace/schema.ts`
- Test: `tests/app/workspace.test.ts`

**Interfaces:**
- Consumes: `PlanSchema`, `Plan`, `Ratio`, `Selection`, `validatePlan` from `lib/plan`.
- Produces (spec §7 layout under `workspace/projects/<id>/`):
  - `ProjectSchema`:
    - `{ id: string; name: string; mode: 'reel' | 'app'; preset: 'faceless' | 'talking-head' | 'app-video'; ratios: Ratio[]; lang: Language; selection: Selection | null; claudeSession: string | null; createdAt: string; updatedAt: string }`;
    - `id` is a slug of the name plus a 6-char suffix from `crypto.randomUUID()`.
  - `VersionOriginSchema`: `{ n: number; by: 'claude' | 'user'; parent: number | null; request: string | null; diff: unknown | null; createdAt: string }`.
  - Functions in `store.ts`, all writes atomic (temp file + rename) and serialised per project through `createQueue()` (marketiyo pattern):
    - `createProject(input: { name; mode; preset; ratios; lang; inputs: string[] }): Promise<Project>`: copies each input file or folder recursively into `inputs/`, never modifying the originals;
    - `listProjects(): Promise<Project[]>`, newest first;
    - `getProject(id): Promise<Project>`, which throws `NotFoundError`;
    - `updateProject(id, patch: Partial<Omit<Project,'id'|'createdAt'>>): Promise<Project>`;
    - `saveVersion(id, input: { plan: Plan; by; parent; request?; diff? }): Promise<number>`: validates the plan first and rejects invalid plans with the validator's errors; writes `versions/vN/plan.json` + `origin.json`; returns N;
    - `listVersions(id): Promise<VersionOrigin[]>`;
    - `readVersion(id, n): Promise<{ plan: Plan; origin: VersionOrigin }>`.
  - Global `workspace/preferences.json` via `getPreferences(): Promise<{ rules: { text: string; addedAt: string; source: string }[] }>` and `addPreference(rule)`.
  - `WORKSPACE_DIR` comes from `REELFORGE_WORKSPACE`, defaulting to `<repo>/workspace`; tests point it at a temp dir.

- [ ] **Step 1: Write the failing tests:**
  - `creates and lists projects`;
  - `imports inputs from a unicode path` (source dir `ğüş İçerik çekimleri` with a nested file → the copy exists, bytes are equal, and the original is untouched);
  - `saveVersion numbers sequentially and records origin`;
  - `saveVersion rejects an invalid plan with validator errors`;
  - `concurrent updates serialise` (20 parallel `updateProject` name changes → the file parses and `updatedAt` is monotonic);
  - `corrupt project.json raises WorkspaceCorruptError naming the file`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS. **Commit** `feat(app): project workspace store with versions and preferences`.

### Task 4: Claude CLI runner

**Files:**
- Create: `lib/app/claude/run.ts`, `lib/app/claude/events.ts`, `lib/app/claude/availability.ts`
- Create (test fixture): `tests/fixtures/fake-claude.mjs`, a Node script that mimics `claude`. Its behaviour depends on env `FAKE_CLAUDE_MODE` (`ok` | `logged-out` | `limit` | `hang`), and it prints stream-json lines to stdout.
- Test: `tests/app/claude.test.ts`

**Interfaces:**
- Produces:
  - `type ClaudeEvent =`
    - `{ kind: 'session'; sessionId: string }`
    - `| { kind: 'text'; text: string }`
    - `| { kind: 'tool'; name: string; summary: string }`
    - `| { kind: 'result'; ok: boolean; text: string; costNote?: string }`
    - `| { kind: 'error'; code: 'auth' | 'limit' | 'transport' | 'timeout'; message: string; resetsAt?: string }`
  - `parseStreamLine(line: string): ClaudeEvent[]` in `events.ts`. It maps Claude Code's `--output-format stream-json --verbose` objects: `system/init` → session; `assistant` text blocks → text; `tool_use` blocks → tool, with `summary` = tool name + first 80 chars of the command or path; `result` → result. Unknown lines → `[]`. Malformed JSON → `[]`.
  - `runClaude(o: { binary: string; cwd: string; prompt: string; resumeSession?: string | null; allowedTools: string[]; timeoutMs: number; onEvent: (e: ClaudeEvent) => void; signal?: AbortSignal }): Promise<{ sessionId: string | null; ok: boolean }>`.
    - Spawns `binary -p --output-format stream-json --verbose --permission-mode acceptEdits --allowedTools <comma-joined> [--resume <id>]` with the prompt on stdin, `cwd` = the project folder.
    - Windows binary quoting, tree kill on timeout or abort, and settle-without-close are copied from marketiyo's `run()`.
  - `classifyFailure(stderr: string, stdout: string): { code: 'auth' | 'limit' | 'transport'; message: string; resetsAt?: string }`. `limit` matches `/session limit|usage limit|rate.?limit|429/i`, and `resetsAt` is captured from `/resets ([^·\n]+)/`. `auth` uses marketiyo's regex.
  - `checkAvailability(binary): Promise<{ status: 'ok' | 'missing' | 'logged-out' | 'no-response'; detail: string }>`: `--version`, then a tiny `-p "ok"` ping (marketiyo `availabilityFrom` semantics, TR/EN hints from i18n).
  - `DEFAULT_ALLOWED_TOOLS = ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep']`.

- [ ] **Step 1: Write the failing tests** (the fake binary is run via `process.execPath` + script path):
  - `parses session, text, tool and result lines`;
  - `ignores malformed lines`;
  - `runClaude streams events and returns sessionId`;
  - `passes --resume when resumeSession given` (the fake echoes its argv in a text event);
  - `availability classifies missing / logged-out / ok`;
  - `classifies rate limit with reset text`: stdout `You've hit your session limit · resets 2pm (Europe/Istanbul)` → `{ code: 'limit', resetsAt: '2pm (Europe/Istanbul)' }`;
  - `timeout kills the process` (`hang` mode, timeoutMs 500 → resolves with `{ ok: false }` and an `error` event with code `timeout` within 3 s).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS. **Commit** `feat(app): claude CLI agent runner with stream events`.

### Task 5: Jobs with persisted events and SSE

**Files:**
- Create: `lib/app/jobs/jobs.ts`, `app/api/projects/[id]/jobs/route.ts` (POST start, GET list), `app/api/projects/[id]/jobs/[jobId]/events/route.ts` (GET, SSE), `app/api/projects/[id]/jobs/[jobId]/resume/route.ts` (POST)
- Test: `tests/app/jobs.test.ts`

**Interfaces:**
- Consumes: `runClaude`, `ClaudeEvent`, `getProject`, `updateProject`.
- Produces:
  - `type JobKind = 'claude' | 'render'`
  - `type JobState = 'running' | 'done' | 'failed' | 'paused-limit' | 'cancelled'`
  - `type JobEvent = { t: string; type: 'claude'; event: ClaudeEvent } | { t: string; type: 'progress'; step: string; pct?: number } | { t: string; type: 'state'; state: JobState; detail?: string }`
  - `startJob(projectId: string, spec: JobSpec): Promise<{ jobId: string }>`. In this task `JobSpec = { kind: 'claude'; prompt: string }`; Task 6 extends it with `| { kind: 'render'; version: number; profile: RenderProfile }`.
    - At most one running job per project; a second start → `JobBusyError`.
    - Events are appended to `projects/<id>/jobs/<jobId>.jsonl` and fanned out to live subscribers.
    - A `claude` job stores the `session` event's id into `project.claudeSession`. A `limit` error ends the job as `paused-limit` with `detail` = `resetsAt`.
  - `subscribe(projectId, jobId, onEvent: (e: JobEvent) => void): () => void`: replays the file first, then streams live.
  - `resumeJob(projectId, jobId): Promise<{ jobId: string }>`: only for `paused-limit` claude jobs. It starts a new claude job with prompt `"Continue where you stopped."` and `resumeSession` = `project.claudeSession`.
  - `cancelJob(projectId, jobId)`: aborts via `AbortSignal`.
  - SSE route: `text/event-stream`, one `data: <json>\n\n` per JobEvent, and it closes after a terminal state.

- [ ] **Step 1: Write the failing tests** (the fake claude binary from Task 4 is set via settings):
  - `claude job streams and finishes done`;
  - `second job while running throws JobBusyError`;
  - `late subscriber receives replayed events`;
  - `limit ends job paused-limit with reset text`;
  - `paused job resumes with --resume` (the fake echoes argv; assert the session id);
  - `cancel aborts and records cancelled`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the jobs module and routes. Job state lives in memory plus the JSONL, so a server restart marks `running` jobs found on disk as `failed` with detail `server restarted`.
- [ ] **Step 4: Run** → PASS. **Commit** `feat(app): jobs with persisted events, SSE, resume after limit`.

### Task 6: Render profiles and the render job

**Files:**
- Create: `lib/render/profiles.ts`, `lib/app/jobs/render-job.ts`
- Modify: `lib/render/layered.ts` (accept a profile: base codec and preset, composite crf and preset, hyperframes quality, workers), `lib/render/render.ts` (pass `--quality`, `--workers`, and `--gpu` when the profile says so), `lib/app/jobs/jobs.ts` (wire `kind: 'render'`)
- Test: `tests/render/profiles.test.ts`, `tests/app/render-job.test.ts`

**Interfaces:**
- Consumes: `renderLayered`, `qa`, `expectsAudio`, `deliverableLumaRefs` (Plan 1); `readVersion`, `startJob`.
- Produces:
  - `type RenderProfile = 'draft' | 'final'`
  - `PROFILES: Record<RenderProfile, { baseCodec: 'ffv1' | 'x264'; basePreset?: string; baseCrf?: number; compositeCrf: number; compositePreset: string; hfQuality: 'draft' | 'delivery'; qa: 'skip' | 'full' }>`:
    - `draft`: `{ baseCodec: 'x264', basePreset: 'veryfast', baseCrf: 16, compositeCrf: 23, compositePreset: 'veryfast', hfQuality: 'draft', qa: 'skip' }`
    - `final`: `{ baseCodec: 'ffv1', compositeCrf: 10, compositePreset: 'slow', hfQuality: 'delivery', qa: 'full' }` (unchanged Plan 1 behaviour)

    Both profiles keep the BT.709 tags and colour params; the speed changes never alter footage colour.
  - `layeredArgs` builders expose the chosen codec, preset and crf so tests can assert on args without rendering.
  - `runRenderJob(projectId, version, profile, emit: (e: JobEvent) => void): Promise<{ outputs: Record<Ratio, string> }>`.
    - Renders every project ratio in parallel with concurrency `max(1, floor(os.cpus().length / 4))`.
    - Writes `versions/vN/render/<profile>-<ratio>.mp4`.
    - Emits `progress` per ratio and stage (`base`, `overlay`, `composite`, `loudness`, `qa`).
    - For `final`, writes `qa.json` per ratio and fails the job if any ratio fails QA.
    - Also writes the thumbnail when `selection.thumbnail` is true, using the first frame of the CTA scene.

- [ ] **Step 1: Write the failing tests:**
  - `draft profile uses x264 veryfast base and crf 23 composite`;
  - `final profile keeps ffv1 base and crf 10`;
  - `both profiles keep BT.709 tags and x264 colour params`;
  - `render job runs ratios concurrently and emits per-ratio progress`: `renderLayered` and `qa` are injected as fakes recording start/end times; with 3 ratios and concurrency 2, two overlap;
  - `final render fails job when a ratio fails QA`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Make `renderLayered`/`qa` injectable via a small `deps` parameter that defaults to the real functions.
- [ ] **Step 4: Run** → PASS. Then one real smoke run: `npx tsx scripts/time-profiles.ts`, which renders the Plan 1 3 s synthetic plan with both profiles and prints wall times. Record both times in the commit message. No quality assertions.
- [ ] **Step 5: Commit** `feat(render): draft/final profiles and parallel render job`.

### Task 7: Setup page

**Files:**
- Create: `lib/app/setup/checks.ts`, `app/api/setup/route.ts` (GET runs checks; POST `{ action: 'download-face-model' }`), `app/setup/page.tsx`, `components/SetupList.tsx`
- Test: `tests/app/setup.test.ts`, `tests/ui/setup.test.tsx`

**Interfaces:**
- Consumes: `checkAvailability`, `run`, `probe` path helpers.
- Produces:
  - `type CheckId = 'node' | 'claude' | 'ffmpeg' | 'python' | 'whisper' | 'mediapipe' | 'face-model' | 'chrome'`
  - `runChecks(): Promise<{ id: CheckId; ok: boolean; detail: string; fix: string | null }[]>`:
    - `node`: ≥ 20;
    - `claude`: via `checkAvailability`;
    - `ffmpeg`/`ffprobe`: on PATH; version line;
    - `python`: 3.10+;
    - `whisper`: `python -c "import faster_whisper"`;
    - `mediapipe`: import;
    - `face-model`: `tools/models/blaze_face_short_range.tflite` exists;
    - `chrome`: `npx hyperframes@0.8.191 browser` status, or doctor output contains a Chrome path.

    Each failing check carries a TR/EN fix hint (install command per OS, e.g. `winget install Gyan.FFmpeg` / `brew install ffmpeg`).
  - `downloadFaceModel(): Promise<void>`: fetches `https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite` to `tools/models/` and verifies size > 100 KB. Only ever runs from the user's button click on the Setup page, which is the user's consent.

- [ ] **Step 1: Write the failing tests:**
  - `node check passes on current runtime`;
  - `missing binary yields fix hint in tr and en` (claudeBinary set to a nonexistent path);
  - `face-model check reflects file presence` (temp `tools/models`);
  - UI `setup page lists checks with ok/fix states and a download button only when face-model fails` (fetch mocked).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** The page is one airy list: one row per check with a green tick, or the fix text in JetBrains Mono plus a copy button. A "Tekrar kontrol et / Check again" button.
- [ ] **Step 4: Run** → PASS. **Commit** `feat(app): setup page with dependency checks and face-model download`.

### Task 8: Projects list and New project

**Files:**
- Create: `app/projects/page.tsx`, `app/projects/new/page.tsx`, `app/projects/[id]/page.tsx` (placeholder workspace: project header, versions list, job log panel fed by SSE, "Render draft" / "Render final" buttons), `app/api/projects/route.ts` (GET list, POST create), `app/api/projects/[id]/route.ts` (GET), `components/ProjectCard.tsx`, `components/NewProjectForm.tsx`, `components/JobLog.tsx`
- Test: `tests/ui/new-project.test.tsx`, `tests/ui/job-log.test.tsx`, `tests/app/projects-api.test.ts`

**Interfaces:**
- Consumes: `createProject`, `listProjects`, `getProject`, `listVersions`, `startJob`, `subscribe`.
- Produces:
  - `POST /api/projects` body `{ name; mode; preset; ratios; lang; inputs: string[] }` → 201 `Project`; zod-validated, 400 with field errors.
  - `NewProjectForm`, which offers:
    - mode/preset as three large choice tiles (Faceless reel · Talking head · App video);
    - name;
    - ratio chips (`9:16` `4:5` `1:1` `16:9`). Defaults are `9:16` for reels and `16:9` for app video, multi-select;
    - language (TR/EN; defaults to the UI language);
    - input paths (a text field per path with "add another"). In this plan the paths are typed by hand; a native folder picker is out of scope.
  - `JobLog`: a step list. Each `claude.tool` event is a row with a short summary; `progress` events update per-ratio bars; a `paused-limit` state shows the reset time and a "Devam et / Resume" button.

- [ ] **Step 1: Write the failing tests:**
  - `new project form submits the selected preset, ratios and paths`;
  - `talking head preset defaults ratios to 9:16`;
  - `job log shows paused-limit with reset time and resume button`;
  - API `POST /api/projects validates and creates`; `rejects missing name with 400`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**, following the approved mockup's spacing and tokens: one-line rows, no tag soup.
- [ ] **Step 4: Run** the tests + `npx next build` → PASS. Manually: `npm run dev`, create a project from the faceless v5 folder (`../video/reel/public`), save the Plan 1 v5 fixture as v1 via a dev-only script `scripts/seed-v5.ts`, click "Render draft", and confirm the job log streams and an MP4 appears. Note the wall time in the commit message.
- [ ] **Step 5: Commit** `feat(app): projects list, new project, project page with job log`.

---

**Next:** Plan 3 (skills: `video-core`, `reel-faceless`, `reel-talking-head`, `app-video`). These include the motion-density gate (`motionGaps` ≤ 3 s), topic assets and custom animations, and the /brag and v5 acceptance tests. Then Plan 4 (option cards, transcript check, storyboard, direct edits, versions, review).
