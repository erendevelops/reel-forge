# Plan 1 of 4: Render Core and Spikes, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deterministic core that turns a `plan.json` into a finished, QA-checked MP4, and use it to settle the two open risks: whether HyperFrames keeps footage colour exact (§5), and whether talking-head reels reach the reference quality (§4.1).

**Architecture:** A TypeScript library (no UI yet) with four parts:
- a zod-validated `plan.json` schema;
- ffmpeg/ffprobe wrappers for probing, preparing media and running QA;
- a compiler that writes a HyperFrames project from a plan plus card templates;
- a renderer that runs `hyperframes render`, applies the loudness finish and writes `qa.json`.

Python is used only where the ecosystem demands it (faster-whisper, face detection). Two spike tasks run real videos through the core and record a decision.

**Tech Stack:** Node ≥ 20, TypeScript 5, zod 3, vitest, tsx · ffmpeg/ffprobe 8.x · HyperFrames `0.8.191`, GSAP `3.14.2` (both vendored into each generated project at compile time, not committed) · Python 3.12, faster-whisper, numpy, mediapipe.

**Spec:** `docs/superpowers/specs/2026-10-24-ai-video-editor-design.md`. Pipeline details: `../video/REEL_EDIT_PIPELINE.md` (the "reel doc") and `../prao/brag-output-2026-10-24-120841/prao-video-reference.md` (the "prao doc").

**Where this sits:**
- **Plan 1 (this):** render core + spikes.
- **Plan 2:** app shell: Next.js, Claude runner, workspace, Setup page, TR/EN, theme.
- **Plan 3:** skills (`video-core`, `reel-faceless`, `reel-talking-head`, `app-video`) and their acceptance tests against /brag and the v5 reel.
- **Plan 4:** UI flows: new project, option cards, transcript check, storyboard workspace, direct edits, versions, review.

Plans 2–4 are written after Task 9 records the renderer decision. If the decision is "Remotion", Tasks 5–7 are redone against Remotion before Plan 2.

## Global Constraints

- Every timing in `plan.json` is in **seconds** (floats). Frames are derived only at render time.
- **Never alter footage colour.** No `eq`, LUTs, gradients or flashes on footage. Working clips are re-encoded only with `out_range=tv` plus explicit BT.709 tags.
- Reel export: 1080×1920 (9:16), **60 fps**, H.264, `yuv420p`, TV range, BT.709, **−14 LUFS integrated, ≤ −1.5 dBTP**. App-video export: 1920×1080 (16:9), **30 fps**.
- Working clips: `-c:v libx264 -preset slow -crf 4 -g 30`, `scale=W:H:flags=lanczos:out_range=tv,fps=<fps>,format=yuv420p`, `-color_range tv -color_primaries bt709 -color_trc bt709 -colorspace bt709`, audio stripped. **Never `-crf 0`** (High 4:4:4 doesn't decode in Chrome).
- HyperFrames renders use `--video-frame-format png` (colour-sensitive sources).
- No whoosh/swoosh SFX files anywhere in the bundled library.
- Windows and macOS. Paths contain non-ASCII characters (`Masaüstü`): never build shell strings, always `spawn(cmd, argsArray)`. Python is invoked with `PYTHONIOENCODING=utf-8`.
- Compiled output is deterministic: the same plan and assets give byte-identical `index.html` (no `Date.now()`, no unseeded randomness).
- Tests that need media generate it with ffmpeg `testsrc2`/`sine` into a temp directory. Only `tests/fixtures/speech-tr.wav` is committed.

## Review Focus

1. **iPhone `.MOV` stored landscape with `rotation=-90`.** The working clip must come out portrait 1080×1920, not sideways. → Task 3, `prepareClip rotates by side-data`.
2. **A full-range (`yuvj420p` / `pc`) source next to TV-range ones.** The output must be TV range with luma unchanged within tolerance. → Task 3, `prepareClip normalises full range`.
3. **A clip with no audio stream, or a 30 fps clip in a 60 fps reel.** It must still prepare and render, not crash on a missing stream. → Task 3, `probe handles no audio` and `prepareClip upsamples 30fps`.
4. **Project paths with Turkish characters and spaces** (`Masaüstü`, `İ`). Every tool must work on them. → Task 2, `run() handles unicode paths`; Task 4, the transcribe test runs from a `ğüş İ` temp dir.
5. **A plan that uses a card the user didn't tick**, or scenes that overlap or leave gaps. The plan must be rejected with a readable error and never rendered. → Task 1, `validatePlan rejects unselected card` / `rejects overlapping scenes`.

---

### Task 1: Repo scaffold + plan schema and validation

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `lib/plan/schema.ts`, `lib/plan/validate.ts`, `lib/plan/index.ts`
- Create: `tests/fixtures/plan-reel-v5.json` (the reel doc's v5 shot list, overlay timeline and caption groups, converted)
- Test: `tests/plan/validate.test.ts`

**Interfaces:**
- Produces:
  - `type CardType = 'title-card'|'numbered-list'|'logo-pop'|'rolling-number'|'checklist'|'bar-chart'|'stamp'|'typed-title'|'follow-outro'`
  - `type CaptionStyle = 'word-build'|'one-word'|'serif-small'|'none'`
  - `type Layout = 'full-face'|'split'|'full-graphics'|'broll'`
  - `type Ratio = '9:16'|'16:9'|'1:1'|'4:5'`
  - `PlanSchema` (zod) and `type Plan = z.infer<typeof PlanSchema>`, with:
    - `{ version: 1; mode: 'reel'|'app'; fps: 30|60; duration: number; ratios: Ratio[]; selection: Selection; scenes: Scene[]; captions: { style: CaptionStyle; groups: CaptionGroup[] }; sfx: SfxCue[]; voice?: { src: string }; music?: Music }`
    - `Scene = { id: string; start: number; end: number; say: string; why: string; layout?: Layout; shots: Shot[]; cards: Card[]; ratioOverrides?: Partial<Record<Ratio, Record<string, unknown>>> }`
    - `Shot = { src: string; from: number; to: number; at: number; punch?: number }`
    - `Card = { type: CardType; start: number; end: number; params: Record<string, unknown> }`
    - `CaptionGroup = { words: [string, number][]; end: number }`
    - `SfxCue = { file: string; at: number; volume: number }`
    - `Music = { src: string; mediaStart: number; volume: number; fadeOut: number }`
    - `Selection = { captions: CaptionStyle; layouts: Layout[]; cards: CardType[]; sfx: boolean; music: boolean; punchIns: boolean; thumbnail: boolean }`
  - `validatePlan(plan: unknown): { ok: true; plan: Plan } | { ok: false; errors: string[] }` (`lib/plan/validate.ts`)

- [ ] **Step 1: Scaffold.** `git init`, then create `package.json` with scripts `test` (`vitest run`), `typecheck` (`tsc --noEmit`) and deps `zod@^3.24`, plus devDeps `typescript@^5.7`, `vitest`, `tsx`, `@types/node`. Add `.gitignore` with `node_modules/`, `.superpowers/`, `out/`, `*.mp4` outside `tests/fixtures`. Commit `chore: scaffold`.
- [ ] **Step 2: Write the failing tests** in `tests/plan/validate.test.ts`:
  - `parses reel v5 fixture`: `validatePlan(fixture).ok === true`; 7 scenes, 12 shots in total; `fps === 60`; `duration === 32`.
  - `rejects unselected card`: the fixture with `selection.cards` minus `'title-card'` → `ok === false`, and `errors[0]` contains `title-card` and `not selected`.
  - `rejects overlapping scenes`: scene 2's start is set to scene 1's end minus 0.5 → an error containing `overlap`.
  - `rejects gaps`: scene 2's start is set to scene 1's end plus 0.5 → an error containing `gap`.
  - `rejects music when not selected`: `music` present while `selection.music === false` → `ok === false`.
  - `rejects card outside its scene`: card start < scene start → `ok === false`.
- [ ] **Step 3: Run** `npx vitest run tests/plan` → FAIL (module not found).
- [ ] **Step 4: Implement** `PlanSchema` and `validatePlan`. Schema errors become `path: message` strings. Then the semantic checks, in order:
  - selection;
  - scene order, overlap and gaps (tolerance 1e-3 s);
  - cards inside their scene;
  - the last scene's end equals `duration`.
- [ ] **Step 5: Build the fixture** from the reel doc §5: the shot table, hook cards at 0.68/1.02/1.28/2.02, title cards Fooocus 6.60–7.50 / Whisper 11.08–11.95 / Upscayl 14.68–15.50 / Browser Use 18.60–19.50 / VoiceStudio 23.54–24.50, and the §4 word list grouped into caption groups of 1–5 words. Scenes: hook, tool ×5, CTA. `src` paths are relative to the plan's assets directory (`s01.mp4` …).
- [ ] **Step 6: Run** `npx vitest run tests/plan && npx tsc --noEmit` → PASS.
- [ ] **Step 7: Commit** `feat(plan): plan.json schema and validation`.

### Task 2: Process runner and ffprobe

**Files:**
- Create: `lib/media/run.ts`, `lib/media/probe.ts`, `tests/helpers/media.ts`
- Test: `tests/media/probe.test.ts`

**Interfaces:**
- Produces:
  - `run(cmd: string, args: string[], opts?: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number }): Promise<{ code: number; stdout: string; stderr: string }>`. Rejects with `RunError` (fields `cmd`, `code`, `stderr`) on non-zero exit or timeout. On Windows a timeout kills the tree with `taskkill /pid <pid> /T /F` (as in marketiyo `killTree`).
  - `probe(file: string): Promise<Probe>`, where `Probe = { duration: number; width: number; height: number; displayWidth: number; displayHeight: number; rotation: number; fps: number; codec: string; pixFmt: string; colorRange: 'tv'|'pc'|'unknown'; colorSpace: string; hasAudio: boolean }`. `displayWidth/Height` account for rotation.
  - Test helper `makeClip(dir: string, o: { w: number; h: number; fps: number; seconds: number; audio?: boolean; fullRange?: boolean; rotate?: 0|90|-90 }): Promise<string>` (`tests/helpers/media.ts`). It uses ffmpeg `testsrc2` and `sine`. Rotation uses `-display_rotation` on input remux.

- [ ] **Step 1: Write the failing tests:**
  - `run() handles unicode paths`: creates `os.tmpdir()/ğüş İ Masaüstü/x.txt` and runs `node -e` to read it → stdout matches.
  - `probe reads basics`: a 1080×1920, 60 fps, 2 s clip with audio → `{fps: 60, width: 1080, height: 1920, hasAudio: true}`, with `duration` within 0.05 of 2.
  - `probe handles no audio`: → `hasAudio === false`, and it doesn't throw.
  - `probe reports rotation`: a 1920×1080 clip with rotate −90 → `rotation === -90`, `displayWidth === 1080`, `displayHeight === 1920`.
  - `probe reports full range`: → `colorRange === 'pc'`.
- [ ] **Step 2: Run** `npx vitest run tests/media/probe.test.ts` → FAIL.
- [ ] **Step 3: Implement `run`** in `lib/media/run.ts` with `spawn(cmd, args, { shell: false })`.
- [ ] **Step 4: Implement `probe`** with `ffprobe -v error -print_format json -show_streams -show_format`. Rotation comes from `side_data_list[].rotation`; fps from `r_frame_rate` as a rational.
- [ ] **Step 5: Run** → PASS. **Commit** `feat(media): process runner and probe`.

### Task 3: Media preparation (working clips, voice, finish)

**Files:**
- Create: `lib/media/prepare.ts`
- Test: `tests/media/prepare.test.ts`

**Interfaces:**
- Consumes: `run`, `probe`, `makeClip`.
- Produces:
  - `prepareClip(src: string, out: string, o: { from: number; duration: number; width: number; height: number; fps: 30|60 }): Promise<void>`. It applies the Global Constraints working-clip settings and trims `[from, from+duration+0.3]`. ffmpeg auto-rotation is left on.
  - `prepareVoice(src: string, out: string): Promise<void>`: `loudnorm=I=-15:TP=-1.5:LRA=11`, 48 kHz WAV.
  - `finishLoudness(src: string, out: string, target: { I: number; TP: number }): Promise<void>`: video stream copied, `loudnorm`, AAC 320k, `-movflags +faststart`.
  - `lumaStats(file: string, t: number, w: number, h: number): Promise<{ yavg: number; ymin: number; ymax: number }>`: `signalstats` at time `t` after `scale=w:h`.

- [ ] **Step 1: Write the failing tests:**
  - `prepareClip writes BT.709 TV range`: probe of the output → `colorRange 'tv'`, `colorSpace 'bt709'`, `fps 60`, 1080×1920, and `hasAudio === false`.
  - `prepareClip rotates by side-data`: rotated 1920×1080 source → output 1080×1920.
  - `prepareClip normalises full range`: full-range source → `colorRange 'tv'`, and the `lumaStats` yavg differs from the source by ≤ 3.
  - `prepareClip upsamples 30fps`: 30 fps source → output fps 60, and duration within 0.05 of the requested duration + 0.3.
  - `finishLoudness hits target`: a `sine` clip at −30 dB, finished at `{I:-14, TP:-1.5}` → integrated LUFS from `ebur128` within ±1 of −14, and true peak ≤ −1.5.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the four functions in `lib/media/prepare.ts`.
- [ ] **Step 4: Run** → PASS. **Commit** `feat(media): working clips, voice prep, loudness finish`.

### Task 4: Word-level transcription

**Files:**
- Create: `tools/transcribe.py`, `tools/requirements.txt` (`faster-whisper`, `numpy`, `mediapipe`), `lib/media/transcribe.ts`
- Create (committed fixture): `tests/fixtures/speech-tr.wav`, ~6 s of Turkish speech saying "Birincisi Fooocus. İkinci Whisper." (generate once with any TTS; note the source in `tests/fixtures/README.md`)
- Test: `tests/media/transcribe.test.ts`

**Interfaces:**
- Produces:
  - CLI `python tools/transcribe.py <audio> <out.json> --lang tr|en|auto --model medium|small --prompt "<proper nouns>"`. It writes `{ language: string; words: { w: string; start: number; end: number }[] }`.
  - `transcribe(audio: string, o: { lang: string; model?: string; prompt?: string }): Promise<Transcript>`, where `Transcript = { language: string; words: { w: string; start: number; end: number }[] }`.

- [ ] **Step 1: Write the failing test** `transcribe returns ordered word times`. Run it from a temp dir named `ğüş İ` with `{lang:'tr', model:'small', prompt:'Fooocus, Whisper'}`. Assert:
  - `words.length >= 4`;
  - starts are non-decreasing;
  - some word, lowercased, includes `whisper`;
  - every `end > start`.

  Mark it `{ timeout: 300_000 }`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement `tools/transcribe.py`.**
  - Decode with ffmpeg to 16 kHz mono s16 WAV, then load with `wave` + numpy and pass the float array to `model.transcribe(..., word_timestamps=True, initial_prompt=prompt)`. Never pass a path: this avoids the PyAV `metadata_errors` crash.
  - Use `device="cpu", compute_type="int8"`.
  - Write JSON as UTF-8 with `ensure_ascii=False`.
- [ ] **Step 4: Implement `transcribe`** to spawn `python` with `PYTHONIOENCODING=utf-8`. If `python` isn't on PATH, try `python3`.
- [ ] **Step 5: Run** → PASS. **Commit** `feat(media): word-level transcription`.

### Task 5: Compiler (plan → HyperFrames project) with reel card templates

**Files:**
- Create: `lib/compile/index.ts`, `lib/compile/types.ts`, `lib/compile/layers.ts` (footage, voice, music, sfx), `lib/compile/captions.ts`
- Create: `lib/compile/cards/title-card.ts`, `numbered-list.ts`, `logo-pop.ts`, `index.ts` (registry)
- Create: `assets/sfx/` (Kenney Interface Sounds, CC0: `drop_001..004`, `maximize_006`, `pluck_002`, `click_002/003/005`, as 48 kHz WAV) and `assets/fonts/` (Inter, Nunito, OFL)
- Test: `tests/compile/compile.test.ts`

**Interfaces:**
- Consumes: `Plan`, `validatePlan`.
- Produces:
  - `type Fragment = { html: string; css: string; timeline: string }`. `timeline` is JS source of GSAP calls on a variable named `tl`, using absolute seconds.
  - `type CompileContext = { width: number; height: number; fps: number; ratio: Ratio; assetsUrl: (p: string) => string }`
  - `RATIO_SIZE: Record<Ratio, [number, number]> = { '9:16': [1080,1920], '4:5': [1080,1350], '1:1': [1080,1080], '16:9': [1920,1080] }`. Templates position by fraction of `ctx.height`/`ctx.width` (caption top = 0.677 × height, list left = 100/1080 × width) so every ratio recomposes. A scene's `ratioOverrides[ratio]` is shallow-merged into each card's `params` for that ratio.
  - `type CardTemplate = { type: CardType; params: z.ZodTypeAny; render(card: Card, id: string, ctx: CompileContext): Fragment }`
  - `cardRegistry: Record<CardType, CardTemplate>`. Unimplemented types throw `not implemented: <type>`.
  - `compile(plan: Plan, o: { outDir: string; assetsDir: string; ratio: Ratio; overlayOnly?: boolean }): Promise<{ indexHtml: string }>`. It writes `outDir/index.html` and copies or links referenced assets plus `gsap.min.js@3.14.2` into `outDir/assets/`. With `overlayOnly: true` it omits footage, voice and music, sets a transparent background, and keeps only cards, captions and SFX (used by Task 7).

- [ ] **Step 1: Write the failing tests:**
  - `compile is deterministic`: compiling the v5 fixture twice gives identical `index.html`.
  - `footage layer`: `index.html` has 12 `<video` elements, each with `muted`, `class="clip"`, and `data-start`/`data-duration`/`data-media-start` equal to the shot's `at`/`to-from`/`from` (to 3 decimals).
  - `voice and sfx`: one `<audio` for the voice at `data-start="0"`. Each SFX cue is an `<audio` with `data-start` equal to `at` and `data-volume` equal to `volume`.
  - `root contract`: `data-composition-id="main"`, `data-width="1080"`, `data-height="1920"`, `data-fps="60"`, and `window.__timelines["main"]` registered.
  - `captions word-build`: for group 1, each word gets a span whose fade tween starts at that word's time, has duration 0.08 and no `scale`. Only the newest word gets colour `#FFD21F` (asserted on the tween string).
  - `recomposes per ratio`: compiling the fixture with `ratio: '1:1'` gives `data-height="1080"`, and the caption container's `top` equals `round(0.677*1080)`.
  - `overlayOnly omits footage`: no `<video`, no voice `<audio`, and `background: transparent` in the CSS.
  - `npx hyperframes@0.8.191 lint <outDir>` exits 0 (timeout 120 s).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement the layers** (footage/voice/music/sfx) and the `compile` orchestration. Each template renders into a scene-absolute `div` with `z-index` by layer order (reel doc §7.2: shots < pop cards < title cards < list < captions).
- [ ] **Step 4: Implement the captions and the three card templates** with the reel doc's §7.3 values:
  - **Caption text:** Inter 800, 66 px, line-height 1.15, `top: 1300` (9:16), max width 900, newest word `#FFD21F`, fade 0.08 s.
  - **Title card:** logo tile 140 px with a yellow number badge (64 px), name in Inter 900 at 118 px (100 px if longer than 9 characters), letter-spacing −3, 260 px above centre. In: `back.out` scale 0.6→1 approximating `spring(damping 12, stiffness 200)`. Out: 0.17 s fade with a slight scale-up.
  - **Numbered list:** `left: 100, top: 200`, 46 px logo, "N. Name" in Inter 800 at 42 px, slides in from −60 px. The current item is yellow, the others white.
  - **Logo pop:** 6 px white border, 26 px radius, scale 0→1 with ±4–6° rotation (the sign alternates by index; no randomness), 0.1 s opacity ramp.

  Text legibility comes only from text-shadow: no gradients.
- [ ] **Step 5: Run** → PASS. **Commit** `feat(compile): plan → HyperFrames with reel cards and captions`.

### Task 6: Render and QA runner

**Files:**
- Create: `lib/render/render.ts`, `lib/render/qa.ts`
- Test: `tests/render/render.test.ts`

**Interfaces:**
- Consumes: `compile`, `run`, `probe`, `finishLoudness`, `lumaStats`.
- Produces:
  - `render(projectDir: string, out: string, o: { fps: number; crf?: number; format?: 'mp4'|'mov' }): Promise<void>`. Runs `npx hyperframes@0.8.191 render <dir> -o <out> -f <fps> --quality delivery --video-frame-format png`. For `mov`: `--format mov`.
  - `qa(file: string, expect: QaExpect): Promise<QaReport>`:
    - `QaExpect = { fps: number; frames: number; width: number; height: number; lufs?: number; lumaRefs?: { src: string; srcT: number; outT: number }[] }`
    - `QaReport = { pass: boolean; checks: { name: string; pass: boolean; detail: string }[] }`
    - Checks:
      - `format`: fps, frame count, size, `tv`, `bt709`;
      - `loudness`: integrated within ±1 LUFS, true peak ≤ −1.5;
      - `luma`: |yavg Δ| ≤ 3 per ref;
      - `contactSheet`: writes `<file>.sheet.jpg` at 2 fps, tiled 16 columns, and always passes.
  - `writeQa(dir: string, report: QaReport): Promise<void>` writes `qa.json`.

- [ ] **Step 1: Write the failing test** `renders a 3 s synthetic plan and passes QA`. Use a plan with one 3 s scene, one prepared `makeClip` shot, one title card and a `sine` voice. Run `compile` → `render` → `finishLoudness(-14)` → `qa`. Expect `pass === true`, with a `luma` ref at t = 1.0 against the prepared clip. Timeout 600 s.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `render`, `qa`, `writeQa`. If the hyperframes output isn't tagged BT.709/TV, add a remux step (`-c:v copy` with `-bsf:v h264_metadata=...` colour tags). Record this in a code comment with the observed ffprobe values.
- [ ] **Step 4: Run** → PASS (or, if `luma` fails here, stop and go straight to Task 7: that's the spike signal arriving early). **Commit** `feat(render): hyperframes render + QA gates`.

### Task 7: Layered render path (the fallback)

Built regardless of the spike result, because it's small and the talking-head path may need it for heavy footage.

**Files:**
- Create: `lib/render/layered.ts`
- Test: `tests/render/layered.test.ts`

**Interfaces:**
- Consumes: `compile(..., {overlayOnly: true})`, `render(..., {format: 'mov'})`, `prepareClip`, `qa`.
- Produces: `renderLayered(plan: Plan, o: { assetsDir: string; workDir: string; out: string; ratio: Ratio }): Promise<void>`. It:
  1. builds the base track with ffmpeg from the prepared shots (concat at the plan's `at` times, optional punch-in via `zoompan`-free `scale+crop` per frame expression, with no colour filters) and lays voice + music + SFX into it;
  2. renders the overlay as ProRes 4444 MOV with alpha;
  3. composites with `overlay=format=auto`, output BT.709 TV tags, then runs `finishLoudness`.

- [ ] **Step 1: Write the failing test** `layered output matches footage luma`. Use the same synthetic plan as Task 6. After `renderLayered`, `qa` passes with a luma ref, and the frame at t = 1.5 (under the title card) shows non-zero alpha compositing: its yavg differs from the base frame by > 1.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `renderLayered`.
- [ ] **Step 4: Run** → PASS. **Commit** `feat(render): layered footage + overlay path`.

### Task 8: Talking-head building blocks

**Files:**
- Create: `lib/talking/trim.ts`, `tools/face_track.py`, `lib/talking/reframe.ts`
- Create: `lib/compile/cards/rolling-number.ts`, `checklist.ts`, `stamp.ts`, `bar-chart.ts`, `typed-title.ts`, `follow-outro.ts`
- Modify: `lib/compile/layers.ts` (layout switching: `full-face` | `split` | `full-graphics`), `lib/compile/cards/index.ts`
- Test: `tests/talking/trim.test.ts`, `tests/talking/reframe.test.ts`, `tests/compile/talking-cards.test.ts`

**Interfaces:**
- Produces:
  - `planTrims(t: Transcript, o: { maxGap: number; pad: number; retakes?: [number, number][] }): Segment[]`, where `Segment = { from: number; to: number }`. These are the kept ranges in source time. Gaps longer than `maxGap` (default 0.35 s) are cut, leaving `pad` (default 0.08 s) after the last word and before the next. Cuts land only between words. `retakes` ranges are removed whole.
  - `remapTimes(t: Transcript, segs: Segment[]): Transcript`: word times in output time.
  - `renderTrimmedTake(src: string, segs: Segment[], out: string): Promise<void>`: ffmpeg `trim/atrim` + `concat`, with a 0.03 s `acrossfade` at every audio join and no colour filters.
  - CLI `python tools/face_track.py <video> <out.json> --fps 10` → `{ w, h, boxes: { t: number; x: number; y: number; bw: number; bh: number }[] }`, normalised 0–1, using mediapipe face detection.
  - `type FaceTrack = { w: number; h: number; boxes: { t: number; x: number; y: number; bw: number; bh: number }[] }` and `type CropPath = { t: number; x: number; y: number; w: number; h: number }[]` (pixels), both in `lib/talking/reframe.ts`.
  - `cropPath(track: FaceTrack, src: { w: number; h: number }, target: Ratio, o?: { smoothing?: number }): CropPath`: a crop window per sample. It keeps the full face box inside the crop with 8% margin, uses exponential smoothing (default 0.85), and never moves more than 2% of the width per sample.
  - Talking-head card templates registered in `cardRegistry`. Each card's `params` schema:
    - `rolling-number`: `{ from: number; to: number; locale: 'tr-TR'|'en-US'; suffix?: string }`, digit-column roll (prao doc scene 1), 0.9 s `expo.out`, 0.07 s stagger;
    - `checklist`: `{ items: { label: string; at: number }[] }`, each tick pops on its `at`;
    - `stamp`: `{ text: string }`, scale 2→1, rotate −12°;
    - `bar-chart`: `{ bars: { label: string; value: number }[] }`;
    - `typed-title`: `{ text: string; label?: string }`, using `tl.set` per character, never `fromTo` on the stacked states (prao doc bug);
    - `follow-outro`: `{ handle: string }`.
  - Layouts in `layers.ts`:
    - `split` puts graphics in the top 50% on `#F7F3EA` and the face video in a rounded (28 px) card at the bottom centre, 70% width;
    - `full-graphics` hides the face;
    - transitions between layouts take 0.4 s `expo.out`.

- [ ] **Step 1: Write the failing tests:**
  - `planTrims cuts long pauses on word boundaries`: words at [0–0.4, 0.5–0.9, 2.0–2.4] → 2 segments, and the cut sits between 0.98 and 1.92.
  - `planTrims removes retakes`: a retake [1.0, 2.0] → no kept segment overlaps it.
  - `remapTimes shifts later words`: the word at 2.0 maps to ≈ 1.06.
  - `cropPath keeps face inside`: a synthetic track with the face drifting from x = 0.2 to 0.7 → every box sits inside its crop with ≥ 8% margin, and the per-step x delta ≤ 2% of the width.
  - `cards land on their words`: compiling a plan with a checklist item at 3.20 puts the tick tween at 3.20 (±0.001).
  - `typed-title has no fromTo`: the compiled timeline for the card doesn't contain `fromTo(` for the state elements.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the trim, remap and renderTrimmedTake functions.
- [ ] **Step 4: Implement** `face_track.py` and `cropPath`. The crop is applied in `prepareClip` via a new optional `crop?: CropPath` option, using `sendcmd`-driven `crop`. *(Modify `lib/media/prepare.ts`; add test `prepareClip applies crop path` to the Task 3 file: a 1920×1080 source with a 9:16 crop gives 1080×1920 output.)*
- [ ] **Step 5: Implement** the six card templates and the layouts.
- [ ] **Step 6: Run** `npx vitest run tests/talking tests/compile` → PASS. **Commit** `feat(talking): trims, face reframing, explainer cards, layouts`.

### Task 9: Spike A, faceless reel colour test, and the renderer decision

**Files:**
- Create: `spikes/faceless-reel/run.ts`, `spikes/faceless-reel/plan.json` (copy of the v5 fixture), `spikes/faceless-reel/RESULT.md`

**Inputs** (read-only, never copied into the repo): `../video/reel/public/s01.mp4 … s12.mp4`, `vo.wav`, `ext/`, `sfx/`. These are the v5 working clips: BT.709, CRF 4.

- [ ] **Step 1:** `run.ts` compiles the plan with `assetsDir` pointing at `../video/reel/public` and renders single-path (Task 6) at 60 fps. Then `finishLoudness(-14)` and `qa` with luma refs at the middle of every shot (12 refs: source t = shot midpoint − `at` + `from`).
- [ ] **Step 2:** Run `npx tsx spikes/faceless-reel/run.ts`. Record in `RESULT.md`:
  - every QA check value;
  - render time;
  - the contact sheet;
  - a side-by-side `hstack` PNG of shot 6 raw vs render.
- [ ] **Step 3:** If any luma check fails, run the same with `renderLayered` (Task 7) and record that too.
- [ ] **Step 4: Decision.** Write at the top of `RESULT.md` exactly one of:
  - `DECISION: hyperframes-single`
  - `DECISION: hyperframes-layered`
  - `DECISION: remotion` (only if both fail; this stops the plan here and Plan 1 Tasks 5–7 get rewritten for Remotion)

  Show Eren the render next to his v5 `reel.mp4`.
- [ ] **Step 5: Commit** `spike: faceless reel colour test — <decision>`.

### Task 10: Spike B, talking head against the quality bar

**Files:**
- Create: `spikes/talking-head/run.ts`, `spikes/talking-head/plan.json`, `spikes/talking-head/SOURCES.md`, `spikes/talking-head/RESULT.md`

- [ ] **Step 1: Footage.** Find one 45–60 s talking-to-camera clip and 2–3 B-roll clips under the Pexels licence. **Ask Eren before downloading** (state each filename, URL and size). Store them outside the repo in `../tbd-spike-media/`, and record the URLs and licence in `SOURCES.md`.
- [ ] **Step 2: Analyse.** Run `transcribe` (lang from the clip), `planTrims`, `face_track`, `cropPath` → 9:16, 4:5, 1:1.
- [ ] **Step 3: Plan.** Hand-author `plan.json` (Claude acts as the future skill here) in the @onur.builds structure:
  - full face hook → split with ≥ 3 cards tied to spoken claims (rolling-number, checklist, stamp) → one full-graphics beat → full face outro with `follow-outro`;
  - `word-build` captions;
  - SFX on every pop.

  `validatePlan` must pass.
- [ ] **Step 4: Render** all three ratios using the path chosen in Task 9, then run `qa`.
- [ ] **Step 5: Check the quality bar** (spec §4.1) and record pass/fail with evidence in `RESULT.md`:
  - trims on word boundaries with no clicks (listen at each cut and log the timestamps checked);
  - the face is never cut off in any ratio (contact sheets at 2 fps per ratio);
  - every card within ±0.1 s of its word (compare card `start` to transcript word times);
  - captions match the transcript;
  - colour and loudness QA pass.
- [ ] **Step 6: Eren's review.** Show the 9:16 render next to both reference reels. Talking head is done only when Eren judges it at their level. Record his verdict verbatim in `RESULT.md`. If he rejects it, log his feedback, fix the core, and repeat from Step 4.
- [ ] **Step 7: Commit** `spike: talking head — <verdict>`.
