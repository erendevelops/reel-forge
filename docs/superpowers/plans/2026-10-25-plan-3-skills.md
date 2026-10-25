# Plan 3 of 4: Skills, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach Claude to plan videos inside the app. This means:
- four skills (`video-core`, `reel-faceless`, `reel-talking-head`, `app-video`);
- a small `rf` command-line tool they call for every mechanical step;
- per-project skill install;
- stage prompts (analyse → plan → revise);
- auto-drafting each new version.

Each preset gets one acceptance run on real material, judged by Eren.

**Architecture:**
- Claude never renders and never writes `plan.json` by hand into place. It runs `rf …` commands (probe, contact sheets, transcription, logo lookup, validation, motion-gap check) and finally `rf save`, which validates and stores a new version.
- When a Claude planning job ends having saved a version, the app starts a draft render of it automatically.
- Skills are plain Markdown folders in the repo (`skills/`), copied into each project's `.claude/skills/` at creation.
- The same plan contract serves every preset. App videos are `full-graphics` scenes built from `custom-animation` cards on the project's own background colour.

**Tech Stack:** Plan 1 core, Plan 2 app, Claude Code skills (SKILL.md + references), `tsx` for the `rf` CLI, HyperFrames `0.8.191` `beats` for music beat grids.

**Spec:** `docs/superpowers/specs/2026-10-24-ai-video-editor-design.md` (§4, §5 skills, §6 option cards + topic assets + motion density + no face zoom + music, §9 defaults/preferences, §12 QA). Source know-how:
- `../video/REEL_EDIT_PIPELINE.md` (the "reel doc");
- `../prao/brag-output-2026-10-24-120841/prao-video-reference.md` (the "prao doc");
- the installed /brag skill at `~/.claude/skills/brag/`. Learn from it; never copy its text.

## Global Constraints

- **Claude uses only the option cards the user ticked.** `rf save` rejects anything else (`validatePlan`).
- **Claude never alters footage colour,** never uses whoosh SFX, and never chooses music silently. Music is optional; when the "music bed" card is ticked, Claude writes 3–4 candidates and the user picks.
- **Talking head:** something visual changes at least every 3 s during speech (`rf gaps` must return `[]` before `rf save`); there's no face zoom (widest crop only); topic logos come via `rf logo`, and concept visuals are `custom-animation` cards. The topic assets need `selection.topicAssets`.
- **Skills quality bar:** the `app-video` skill must be as good as or better than /brag, judged by Eren comparing a re-made prao video with the shipped `brag.mp4`. Reel skills are held to the same bar against his v5 reel (faceless) and the two reference reels (talking head).
- **Claude replies in the project's language** (TR or EN). Captions follow the spoken language.
- **Speed (Eren's standing preference):** minimum checks he can't eyeball himself, one ratio per acceptance run, and no extra analysis passes.
- Windows + macOS; non-ASCII paths; `spawn(cmd, argsArray)` only.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Claude writes a plan using an unticked card, or a static stretch longer than 3 s.** `rf save` refuses with the validator's message, and nothing is stored. → Task 1, `save rejects unselected card` and `save rejects motion gaps for talking head`.
2. **Claude stops mid-plan on the usage limit.** No half-written version exists, and Resume continues. → Task 3, `no version is saved when the job fails before rf save`.
3. **The input paths Claude passes to `rf` contain Turkish characters/spaces,** or point outside the project. Commands work on the former and refuse the latter. → Task 1, `rf refuses paths outside the project` and `rf probe handles a unicode path`.
4. **A logo the icon sets don't have** (a small indie tool). `rf logo` returns `{ found: false }`, and the skill falls back to the tool's site/GitHub per the reel doc §6.4; it never invents a logo. → Task 1, `logo not found is explicit`.
5. **Two revisions in a row.** Each `rf save` stores a new version whose parent is the version it revised, and the user's manual-edit diffs are in the prompt. → Task 3, `revise prompt carries parent and user diffs`.

---

### Task 1: `rf`, the command-line tool the skills call

**Files:**
- Create: `scripts/rf.ts` (entry), `lib/rf/commands.ts`, `lib/rf/context.ts`
- Test: `tests/rf/rf.test.ts`

**Interfaces:**
- Consumes: Plan 1 `probe`, `prepareClip`, `transcribe`, `planTrims`, `cropPath`, face track CLI, `validatePlan`, `motionGaps`, `resolveLogo`, `compile` (lint only). Plan 2 `saveVersion`, `getProject`, `getPreferences`.
- Produces:
  - `rf <command> [args]` prints **one JSON object** to stdout and exits 0, or prints `{ "error": string }` and exits 1. It always runs with cwd = the project folder, and resolves the project from `REELFORGE_PROJECT` (an id, set by the job runner) plus `REELFORGE_WORKSPACE`.
  - `resolveInProject(p: string): string` in `lib/rf/context.ts`. Relative paths resolve against the project folder. Anything outside it throws `path outside project`.
  - Commands (`lib/rf/commands.ts`, `COMMANDS: Record<string, (args: string[]) => Promise<unknown>>`):
    - `project` → `{ project, preferences, versions }`
    - `probe <file>` → `Probe`
    - `sheet <video> <out.jpg> [--every <s>]` → `{ out }`: contact sheet, 1 frame per `--every` seconds (default 2), 216 px wide tiles, timestamps drawn with an explicit font file (Windows `C:/Windows/Fonts/arial.ttf`, macOS `/System/Library/Fonts/Supplemental/Arial.ttf`)
    - `cuts <video>` → `{ cuts: number[] }`: scene changes > 0.3
    - `transcribe <audio|video> --lang <tr|en|auto> [--prompt <names>]` → `Transcript`
    - `prep <src> <out> --from <s> --duration <s> --ratio <r> --fps <30|60> [--crop <crop.json>]` → `{ out }`
    - `trims <transcript.json> [--max-gap 0.35]` → `{ segments }`
    - `facetrack <video> <out.json>` → `{ out, samples, detected }`
    - `crop <track.json> --ratio <r>` → `{ path: CropPath }`
    - `logo <name>` → `{ found: true, slug, title, hex, file }` (writes `assets/si/<slug>.svg` in the project) | `{ found: false }`
    - `beats <audio>` → `{ bpm, beats: number[], drop?: number }`, wrapping `npx hyperframes@0.8.191 beats`
    - `validate <plan.json>` → `{ ok, errors }`
    - `gaps <plan.json>` → `{ gaps }`
    - `save <plan.json> [--request <text>] [--parent <n>]` → `{ version }`. It runs `validatePlan`. For preset `talking-head` it also requires `motionGaps` to be empty. On failure: exit 1 with the errors, and nothing is stored. Saves with `by: 'claude'`.

- [ ] **Step 1: Write the failing tests** (spawn `npx tsx scripts/rf.ts` with env pointing at a temp workspace and project):
  - `project prints project, preferences and versions`;
  - `rf probe handles a unicode path` (clip in `inputs/çekim İ 1/`);
  - `rf refuses paths outside the project` (`probe ../../x.mp4` → exit 1, `path outside project`);
  - `save stores a valid plan as a new version` (v5 fixture → `{ version: 1 }`);
  - `save rejects unselected card` (exit 1, error contains `not selected`, `listVersions` is empty);
  - `save rejects motion gaps for talking head` (talking-head project + the spike plan → exit 1, error lists gaps);
  - `logo resolves ChatGPT and writes the svg`;
  - `logo not found is explicit` (`Zzqx Tool` → `{ found: false }`);
  - `unknown command exits 1 with the command list`.
- [ ] **Step 2: Run** `npx vitest run tests/rf` → FAIL.
- [ ] **Step 3: Implement** `scripts/rf.ts`, which parses argv, looks up `COMMANDS`, prints JSON and sets the exit code; and the commands as thin wrappers over the existing library functions.
- [ ] **Step 4: Run** → PASS. **Commit** `feat(rf): command-line tool for skills`.

### Task 2: Core additions for app videos and music

**Files:**
- Modify: `lib/plan/schema.ts` (`Plan.look?: { background: HexColor; ink?: HexColor }`), `lib/compile/layers.ts` (panel colour from `plan.look.background`, default `#F7F3EA`), `lib/plan/validate.ts`
- Create: `lib/plan/music.ts`
- Test: `tests/compile/look.test.ts`, `tests/plan/music.test.ts`

**Interfaces:**
- Produces:
  - `Plan.look`: optional. When `mode === 'app'`, `look.background` is required (validator error `app videos need look.background`).
  - `MusicCandidatesSchema` = `{ candidates: { title: string; artist: string; url: string; license: string; why: string; previewUrl?: string; contentId?: boolean }[] }`. Length 3–4, `url` must be https. Stored by the skill at `analysis/music-candidates.json`; Plan 4's UI shows it for the user to pick.
  - `validateMusicCandidates(x: unknown): { ok: true } | { ok: false; errors: string[] }`.

- [ ] **Step 1: Write the failing tests:**
  - `full-graphics panel uses look.background`: compile an app plan with `look.background: '#0B0B0C'` → the layout background CSS has `#0B0B0C` and no `#F7F3EA`;
  - `reels keep the beige default`;
  - `app plan without look.background is rejected`;
  - `music candidates need 3–4 https entries`;
  - `music candidates require license text`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run tests/compile tests/plan` → PASS. **Commit** `feat(core): plan look colours; music candidate contract`.

### Task 3: Skill install, stage prompts, auto-draft

**Files:**
- Create: `lib/app/claude/install.ts`, `lib/app/claude/prompts.ts`, `app/api/projects/[id]/claude/route.ts`
- Modify: `lib/app/workspace/store.ts` (`createProject` calls `installSkills`), `lib/app/jobs/jobs.ts` (claude jobs get env `REELFORGE_PROJECT`, `REELFORGE_WORKSPACE`, `REELFORGE_ROOT`; after a `done` claude job whose version count grew, start `{ kind: 'render', version: latest, profile: 'draft' }`), `lib/app/claude/run.ts` (accept `env`), `app/projects/[id]/ProjectClient.tsx` ("Plan oluştur / Make the plan" button when there are no versions; a "Claude'a söyle… / Tell Claude…" box + send when there are)
- Test: `tests/app/install.test.ts`, `tests/app/prompts.test.ts`, `tests/app/autodraft.test.ts`

**Interfaces:**
- Consumes: `Project`, `getPreferences`, `listVersions`, `startJob`, `registerExecutor`.
- Produces:
  - `installSkills(projectId: string): Promise<void>`. Copies `skills/video-core/` and `skills/<preset skill>/` into `<project>/.claude/skills/`. Writes `<project>/CLAUDE.md`, which carries:
    - project name, preset, ratios and language;
    - the option-card selection (once set);
    - the learned preferences;
    - "Use `rf` for every mechanical step; finish with `rf save`. Reply in <language>."

    It also writes `<project>/rf.cmd` (Windows) and `<project>/rf` (POSIX) shims that run `npx tsx "<REPO_ROOT>/scripts/rf.ts" %*` / `"$@"`. Preset skill map: `faceless → reel-faceless`, `talking-head → reel-talking-head`, `app-video → app-video`.
  - `buildPrompt(stage: 'analyse' | 'plan' | 'revise', ctx: { project: Project; preferences: Preferences; versions: VersionOrigin[]; request?: string; userDiffs?: unknown[] }): string`:
    - **analyse:** inventory the inputs, run the preset's analysis (probe, sheets, transcription, music candidates if ticked), write `analysis/`, and report a short summary. No plan.
    - **plan:** write `plan.json` per the preset skill using only the ticked cards, then `rf validate`, `rf gaps` (talking head) and `rf save --request "first cut"`.
    - **revise:** apply the user's request to the latest version. The prompt includes `--parent <latest>`, the request verbatim, and the diffs of user versions since the last Claude version.

    Every prompt ends with the reply-language line.
  - `POST /api/projects/:id/claude` body `{ stage, request? }` → starts a claude job with `buildPrompt(...)` → 201 `{ jobId }`.
  - `defaultSelection(preset: Preset): Selection` in `lib/app/claude/install.ts`. `createProject` sets it when `selection` is null, and Plan 4's option-card screen replaces it.
    - `faceless`: Eren's v5 set: word-build captions; title-card, numbered-list, logo-pop; sfx; punchIns; thumbnail; no music; no topicAssets.
    - `talking-head`: word-build captions; layouts full-face/split/full-graphics; rolling-number, checklist, stamp, bar-chart, typed-title, logo-pop, follow-outro, custom-animation; sfx; thumbnail; topicAssets true; no punchIns; no music.
    - `app-video`: captions none; layouts full-graphics; custom-animation, rolling-number, checklist, typed-title; sfx; music true; thumbnail; topicAssets true.
  - `PATCH /api/projects/:id` body `{ selection }`, validated by `SelectionSchema`, for Plan 4 and for tests.

- [ ] **Step 1: Write the failing tests:**
  - `new projects get the preset's default selection` (talking-head → `topicAssets: true`, `punchIns: false`);
  - `install copies core + preset skill, writes CLAUDE.md and rf shims` (talking-head project → `.claude/skills/video-core/SKILL.md` and `.claude/skills/reel-talking-head/SKILL.md` exist, and CLAUDE.md contains `Reply in Türkçe` for `lang: 'tr'`);
  - `plan prompt lists only ticked cards and the motion rule for talking head`;
  - `revise prompt carries parent and user diffs`;
  - `prompts end with the reply language`;
  - `auto-draft starts after a claude job that saved a version` (the fake claude runs `rf save` via a new `FAKE_CLAUDE_MODE=save` mode → a render job with profile `draft` is started with the new version; the render executor is replaced by a recording fake in the test);
  - `no version is saved when the job fails before rf save` (mode `limit` → versions unchanged, no render job).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Extend `tests/fixtures/fake-claude.mjs` with mode `save`, which shells `rf save` on a fixture plan copied into the project.
- [ ] **Step 4: Run** `npx vitest run tests/app` → PASS. **Commit** `feat(app): project skills, stage prompts, auto-draft`.

### Task 4: `video-core` skill (shared)

**Files:**
- Create: `skills/video-core/SKILL.md`, `skills/video-core/references/{plan-contract,rules,cards,assets,music,qa}.md`, `skills/video-core/examples/plan-faceless-v5.json` (copy of the Plan 1 fixture)
- Create: `tests/skills/skills-lint.test.ts` (shared by Tasks 4–7)

**Content requirements:**
- **`SKILL.md`** (frontmatter `name: video-core`, a `description` naming when to load it). It covers:
  - the stage model (analyse / plan / revise);
  - "everything mechanical is an `rf` command" with the command table;
  - "never render, never write outside the project, finish with `rf save`";
  - where the preset skills take over.
- **`plan-contract.md`:** every `Plan` field with its type and meaning, generated by hand from `lib/plan/schema.ts`. It covers:
  - `at` = timeline, `from`/`to` = source;
  - seconds everywhere;
  - per-ratio overrides;
  - `look`, `facePos`, `topicAssets`;
  - one worked example per card type, with params validated by the lint test.
- **`rules.md`:**
  - global hard rules (spec §9);
  - "only ticked cards";
  - preferences from CLAUDE.md override preset defaults;
  - when feedback states a lasting preference, end your reply with a line `PREFERENCE: <text>`, which the app (Plan 4) offers to save.
- **`cards.md`:** when to use each card, the timing rules (enter on the word, hold to read: about 0.5 s + 0.3 s per word), and the SFX family per card type (reel doc §7.4, prao doc §7 table), with no whooshes.
- **`assets.md`:**
  - `rf logo` first, then the reel doc §6.4 GitHub/site fallback (download into `assets/ext/`, with the source noted in `analysis/assets.json`);
  - never invent a logo;
  - `custom-animation` fragment rules from `lib/plan/fragment.ts` (literal `tl` calls only, no loops, no `random`, no URLs, no `<script>`, relative assets only), with 2 small worked examples (a growing bar, a flow diagram).
- **`music.md`:**
  - only if the music card is ticked;
  - search royalty-free libraries (e.g. Pixabay Music) and write `analysis/music-candidates.json` (3–4, each with why and licence notes, flag Content ID);
  - "premium/Apple-style = minimal modern electronic with a clear build";
  - after the user picks: `rf beats`, offset `mediaStart` so the drop lands on the reveal, volume well under SFX (music-only ≈ −30 dB mean).
- **`qa.md`:** what the app checks automatically (so Claude doesn't), and the one thing Claude does: after a draft exists, `rf sheet` the draft at 2 fps and read it, checking every card/caption against the plan.

- [ ] **Step 1: Write the failing lint test** `skills lint`. For every `skills/*/SKILL.md`:
  - frontmatter has `name` equal to the folder name and a `description` of 1–500 chars;
  - every relative link resolves;
  - every `rf <cmd>` mentioned exists in `COMMANDS`;
  - every card type mentioned in backticks exists in `CARD_TYPES`;
  - every JSON code block tagged `plan-json` passes `validatePlan`;
  - every `custom-animation` example passes `checkFragment`.
- [ ] **Step 2: Run** `npx vitest run tests/skills` → FAIL (no skills yet).
- [ ] **Step 3: Write the skill files** per the content requirements above.
- [ ] **Step 4: Run** → PASS. **Commit** `feat(skills): video-core`.

### Task 5: `reel-faceless` skill

**Files:** `skills/reel-faceless/SKILL.md`, `skills/reel-faceless/references/{analyse,plan,style}.md`

**Content requirements** (from the reel doc; condensed, not copied):
- **analyse:**
  - `rf probe` every clip;
  - `rf sheet` per clip (every 6 s for long clips, 2 s for short);
  - map clips to content in `analysis/clips.json`;
  - VO: `rf transcribe --lang <project lang> --prompt "<proper nouns>"`;
  - write `analysis/transcript-review.json` for the user to correct (Plan 4 UI). Keep Whisper's timestamps and the user's words.
  - Reference reels, if given: `rf sheet` + `rf cuts` + transcript, then a style spec in `analysis/style.md`. Take the structure from references and the pacing from the user's preferences.
- **plan:**
  - cuts land on word starts;
  - shots 2–4 s;
  - result-like footage over README text;
  - the signature shot opens and closes the reel;
  - max 2 soft punch-ins (only if ticked);
  - list items land as title cards leave;
  - captions per the ticked style.
- **style:** reel doc §9 rules as defaults (calm pacing, no colour changes, fade-only captions, safe margins, thumbnail).
- **Gate:** `rf validate` ok → `rf save`.

- [ ] **Step 1:** Extend `skills lint` with `reel-faceless mentions the transcript-review step and the 2–4 s shot rule` (string checks). Run → FAIL.
- [ ] **Step 2:** Write the files.
- [ ] **Step 3:** Run → PASS. **Commit** `feat(skills): reel-faceless`.

### Task 6: `reel-talking-head` skill

**Files:** `skills/reel-talking-head/SKILL.md`, `skills/reel-talking-head/references/{analyse,plan,graphics}.md`

**Content requirements** (from spec §4.1, §6, §13 and the Task 10 spike):
- **analyse:**
  - `rf transcribe`;
  - `rf trims` (dead air, retakes);
  - `rf facetrack` → `rf crop --ratio` per ratio. The widest crop only, never tighter;
  - set `facePos` from the track;
  - note every product/brand/tool name in the transcript → `analysis/topics.json`.
- **plan:**
  - layout rhythm: full-face hook → split → full-graphics beat → full-face outro;
  - **something visual changes every 1.5–2.5 s while he/she is speaking**. Gate: `rf gaps` must be `[]`;
  - every named product gets its logo on the word (`rf logo`) when `topicAssets` is ticked;
  - every claim or number gets a card (rolling-number, checklist, stamp, bar-chart, typed-title);
  - concepts without a logo get a `custom-animation`;
  - captions stay readable on the beige panel (ink `#111827` in split and full-graphics scenes, per the spike's contrast finding);
  - no punch-ins unless ticked.
- **graphics:** the card look from the onur.builds / msevimli references (spec §13), and when to use split vs full-graphics.
- **Gate:** `rf validate` ok and `rf gaps` = `[]` → `rf save`.

- [ ] **Step 1:** Extend `skills lint`: `talking-head skill requires rf gaps before save and forbids face zoom`. Run → FAIL.
- [ ] **Step 2:** Write the files.
- [ ] **Step 3:** Run → PASS. **Commit** `feat(skills): reel-talking-head`.

### Task 7: `app-video` skill

**Files:** `skills/app-video/SKILL.md`, `skills/app-video/references/{inspect,plan,compose,tones}.md`

**Content requirements.** First read `~/.claude/skills/brag/` end to end (SKILL.md, references/*). Then write our own version, without copying its text. It must cover everything brag's workflow gets right, in our plan contract:
- **inspect:**
  - read the project repo (path from inputs) for brand tokens, icons, logo SVG, UI strings in the project language, store listing, and screenshots;
  - write `analysis/product.json`, answering a 9-question rubric (what it is, who for, strongest number/claim, the key flow, signature visual, tone, …);
  - every on-screen claim must exist in the product.
- **plan:**
  - hook (most striking number/claim, ≤3 s) → reveal → 2–3 product moments in entry → action → result order → punchline → outro; 15–25 s;
  - write `analysis/storyboard.md` (beat by beat), which the app shows in Plan 4;
  - if music is ticked: candidates first, then the beat grid via `rf beats`, with scene seams on beats.
- **compose:**
  - each scene is `layout: 'full-graphics'`, with `look.background`/`ink` from the brand tokens;
  - the UI is rebuilt and animated as `custom-animation` cards, never panning over screenshots (screenshots only in the outro fan);
  - motion rules: arrive slow, leave fast; titles land and hold still; vary the entrances; transitions have a cause; reading time; overlap at a third done (prao doc §6);
  - SFX on every visible action from the prao doc §7 families, no whooshes;
  - poster = a settled outro frame;
  - prao-doc bugs to avoid: no `fromTo` on stacked states, and `set` for visibility.
- **tones:** our own short versions of the tone presets (default, polished, app-store, cinematic, deadpan, chaotic) as creative direction; the user's preferences override them.
- **Gate:** `rf validate` ok → `rf save`.

- [ ] **Step 1:** Extend `skills lint`: `app-video skill rebuilds UI as custom-animation and forbids panning screenshots outside the outro`. Run → FAIL.
- [ ] **Step 2:** Read brag, then write the files.
- [ ] **Step 3:** Run → PASS. **Commit** `feat(skills): app-video`.

### Task 8: Acceptance runs (Eren judges)

This task needs Eren to have re-logged into `claude` (the CLI reported "OAuth session expired" during Plan 2). If it's still expired, stop and ask him to run `claude` once.

One run per preset, draft profile, a single 9:16 ratio (16:9 for app video), started through the app UI:
1. **Faceless:** a new project from `../video/reel/public` with Eren's v5 option cards → analyse → plan. Auto-draft renders. Show Eren the draft next to his v5 reel.
2. **Talking head:** the Trent Peek CC-BY clip from `../tbd-spike-media/` with talking-head defaults (topicAssets on) → analyse → plan. Show the draft next to the two reference reels. `rf gaps` was `[]` at save (from the job log).
3. **App video:** the prao repo (`../prao`) with screenshots → analyse → plan. Show the draft next to `brag.mp4`.

- [ ] **Step 1:** Check `claude` is logged in (Setup page shows ✓).
- [ ] **Steps 2–4:** Run each preset. Record in `docs/superpowers/plans/2026-10-25-plan-3-acceptance.md`: job duration, Claude usage notes if any, the render time, and the output path.
- [ ] **Step 5:** Eren's verdict per preset, recorded verbatim. Anything he rejects becomes a skill revision (edit the skill, `revise` the same project, re-draft). Repeat until he accepts or explicitly defers.
- [ ] **Step 6: Commit** `docs: plan 3 acceptance results`.

---

**Next:** Plan 4 (UI): option cards before planning, transcript check, music pick, the storyboard workspace with direct edits, version compare, review and feedback, and saving learned preferences.
