# AI Video Editor: Design

Date: 2026-10-24 · Status: draft for approval · Working name: **Reelforge** (placeholder, not decided)

## 1. Intent

Eren has made two videos end to end with Claude and was happy with both:

- an Instagram reel cut from faceless desk footage plus a voiceover, built in Remotion (`../video/REEL_EDIT_PIPELINE.md`);
- a launch film for the prao app, rebuilt from the app's own code and animated to music, built in HyperFrames via the /brag skill (`../prao/brag-output-2026-10-24-120841/prao-video-reference.md`).

Both took several rounds of feedback, and most of the quality came from rules learned in those rounds: calm pacing, never touching footage colour, BT.709 export, no whooshes, music well under the SFX, and so on. The app packages these workflows so other people can get the same result without the trial and error. **Claude does the work. The app is a calm, good-looking place to steer it.** The user picks a mode and the building blocks, approves a storyboard, gets a render, and iterates through versions, either by editing directly or by telling Claude.

Those two reference docs are part of this spec. Every pipeline detail, gotcha and default in them carries over unless this document says otherwise.

## 2. Who it's for and how it ships

- Content creators and indie developers, Turkish and English speaking, many of them not developers.
- Same distribution model as marketiyo (`github.com/erendevelops/marketiyo`): a local app the user runs on their own machine (`npm run dev` → browser at localhost), source-available. No accounts, no cloud, no database.
- **Windows 10/11 and macOS**, same as marketiyo (my call). Windows gotchas from the docs are handled, and macOS paths, fonts and process handling are first-class from day one.
- **Design for Pro-plan limits** (my call): anything mechanical runs as deterministic scripts the skills call: probing, contact sheets, transcription, word-timing math, building the composition from `plan.json`, QA measurements. Claude's turns go to judgement: tagging clips, writing the plan, picking cards, reading contact sheets, answering feedback. When a run hits a usage limit, the error is classified like marketiyo's auth/transport errors, partial work stays on disk, and the run can be resumed.
- **Licensing** (my call): our skills are written fresh from Eren's two docs, not copied from /brag's text.
- **Skill quality bar** (Eren): the fresh skills must be **as good as or better than /brag**.
  - The builder studies the installed /brag skill (`~/.claude/skills/brag/`, all files) to learn what it gets right: its inspect → plan → brief → compose → check → render → deliver workflow, motion rules, audio direction, snapshot/contact-sheet review and quality gates. It learns from the skill without copying its text.
  - **Acceptance test:** the new `app-video` skill re-makes the prao launch video from the prao repo. Eren compares it side by side with the shipped `brag.mp4` and judges it equal or better.
  - The reel skills are held to the same bar against Eren's v5 reel. Third-party tools (HyperFrames, GSAP, Remotion if used) are installed from npm at Setup, not vendored. Kenney SFX (CC0) and Google Fonts can be bundled. The builder verifies each license before bundling anything else.
- AI runs through the user's own **Claude Pro/Max subscription** via the locally installed `claude` CLI. No API key, and the app never talks to Anthropic directly. *(Gemini, marketiyo's second provider, is not in scope: this work needs an agent with tools, not text completion.)*

## 3. Goals, non-goals, anti-goals

**Goals**
- Two modes: **Reel** and **App video**.
- Every project follows: inputs → option cards → (transcript check) → storyboard → approve → render → review → feedback → new version.
- Two ways to change anything, both producing versions: **direct edits** in the UI and **requests to Claude**.
- Version history: every version keeps its plan, its render, its QA results and the feedback that produced it.
- Every scene in the storyboard shows what's on screen, which option cards and sounds it uses, and Claude's reason.
- Multiple aspect ratios per project (16:9, 9:16, 1:1, 4:5), recomposed rather than cropped.
- TR/EN for the whole UI and for Claude's replies.
- A lightweight codebase: the know-how lives in Claude skills; the app is UI, files, and a process runner.

**Non-goals (v1)**
- A general-purpose NLE (free multi-track editing like Premiere/CapCut).
- Posting to Instagram/TikTok/YouTube.
- Cloud rendering or hosted accounts.
- AI-generated footage, avatars or voice cloning.

**Anti-goals: failure even if it technically works**
- Changing the colour, brightness or contrast of the user's footage (the v3 "looks dark and artificial" bug from the reel doc).
- Busy, dizzying edits by default: fast cuts, continuous zooms, bouncy captions, whoosh transitions.
- Claude adding building blocks the user didn't tick (see §6).
- A cluttered, text-heavy UI. Eren explicitly rejected the first mockup for feeling "clamped".
- Claude silently choosing music. When music is used, the user picks the track from Claude's suggestions.

## 4. Modes

### 4.1 Reel (vertical first)

Starts from the user's footage and voice; **the spoken words are the clock**. Two style presets at launch:

| Preset | Inputs | What Claude mainly does | Reference |
|---|---|---|---|
| **Faceless B-roll + voiceover** | Folder of clips, one VO audio file, optional reference reel URLs | Tag clips, pick the best moment per sentence, cut on word starts, logo/title/list cards, captions | Eren's reel (`REEL_EDIT_PIPELINE.md`) |
| **Talking head + graphics** | One or more takes of a person speaking (camera audio is the voice), optional B-roll, optional reference reels | Turn spoken claims into animated cards (counter, checklist, chart, stamp, typed title…); switch layouts between full face / split (graphics top, face card bottom) / full graphics; captions; trim dead air | Reference reels @onur.builds `Dej4G75uvrI` and @msevimli_ `DcteZpOiD-9` (analysis summarised in §13) |

**All three (faceless reel, talking-head reel, app video) ship in v1** (Eren's decision). Talking head is the only unproven one, so it gets its own spike and quality bar:

- **Spike input:** Eren won't record test footage. The quality target is the two reference reels he gave (§13). Test footage comes from freely licensed talking-to-camera stock clips (for example Pexels, whose licence allows this), found by the builder: ideally one 45–60 s take with natural pauses, plus a few B-roll clips. The reference reels themselves are used only as the style and quality target and for testing card planning from their transcripts. They're never shipped or redistributed.
- **The spike proves:** dead-air and retake trimming; reframing that keeps the face in frame for 9:16, 4:5 and 1:1; layout switching (full face → split → full graphics) driven by `plan.json`; and 3+ graphic cards tied to spoken claims.
- **Quality bar (all must pass):**
  - Trims land on word boundaries with no audible clicks or swallowed syllables. A short audio crossfade at each cut is fine.
  - The face is never cut off and never jumps between shots without a cut.
  - Every card appears on the word it illustrates (±0.1 s) and carries the right number or text.
  - Captions are word-accurate after the transcript check.
  - The colour/loudness QA from §12 passes.
  - **Eren watches the result next to the two reference reels and judges it at their level.** Until he does, talking head isn't done.
- **Order:** this spike runs right after the renderer colour spike (§5), before the app's UI work, so both risky pieces are settled first.

Each preset carries its own analysis steps and defaults. On top of the preset sits the user's own layer: reference reels they paste are analysed into a style spec, and their feedback becomes learned preferences (§9).

### 4.2 App video

Starts from a **project folder** (code), plus optional screenshots, logo, brand tokens, store listing and a music file; **music beats are the clock**. Claude reads the code, rebuilds the key UI in HTML and animates it acting (typing, tapping, counters, lists updating), following the prao doc and the /brag workflow: angle → hook → 3 product moments → punchline → outro, scene seams on beats, an SFX for every visible action.

## 5. Architecture

```
Browser UI (Next.js, localhost)
   │  reads/writes JSON + watches files
   ▼
Local server (Next.js API routes)
   ├─ spawns `claude` (agent mode) in the project folder, streams its progress events
   ├─ runs deterministic tools directly when no judgement is needed (ffprobe, preview build)
   └─ workspace/<project>/  ← plain files, the only state
```

- **Claude runner.** Follows marketiyo's `lib/providers/claude-code.ts`: binary discovery, login check via a tiny ping, Windows `taskkill /T` tree kill, failure classification. The difference: runs are **agentic** (Claude needs Bash for ffmpeg/whisper/render, and Read for contact sheets). They are scoped to the project folder with an explicit tool allowlist, and the UI shows a live progress log. Each project keeps one Claude session id so follow-up requests resume with context. Exact CLI flags are the builder's call.
- **Skills carry the know-how.** The app ships skills, installed into each project's `.claude/skills/`:
  - `reel-faceless`: the reel doc's pipeline.
  - `reel-talking-head`: the new preset.
  - `app-video`: the prao/brag pipeline.
  - a shared `video-core` skill: transcription, captions, SFX library rules, QA gates, render and export settings, the plan file contract.

  The skills tell Claude to write its output as the files in §7, never only as chat.
- **One renderer.** v1 uses a single rendering engine for both modes, so users install one toolchain and the app has one preview/edit model. **Preferred: HyperFrames** (HTML + GSAP, which Claude writes naturally, and prao proved the motion-graphics quality). **First build task is a spike:** re-render the faceless reel's v5 shot list in HyperFrames and pass the reel doc's §8.3 QA (BT.709 TV range, signalstats luma match against the raw clips, 60 fps, −14 LUFS). If headless Chrome shifts footage luma, try the **layered fallback** before abandoning HyperFrames: ffmpeg lays down the footage untouched (trims, BT.709), HyperFrames renders cards and captions on a transparent layer, and ffmpeg composites them. "One renderer" means one editing model and one card library for the user, not one binary. Only if that also fails does the whole app move to Remotion. *(My call: Eren agreed to one engine under the hood; how it's layered is technical.)*
- **Dependencies** the app checks on a Setup page with fix-it hints, marketiyo-style: Node, `claude` + login, ffmpeg/ffprobe, Python + faster-whisper, yt-dlp, Chrome (for HyperFrames). Known gotchas from the docs must be handled: the faster-whisper/PyAV `metadata_errors` crash (decode via ffmpeg → numpy; we hit it again during this design), CUDA missing → force CPU, `drawtext` needs an explicit font on Windows, sequential npm installs, UTF-8 output on Windows.

## 6. Option cards

Before planning, the user picks **option cards**: the building blocks allowed in the edit. **Claude uses only what is ticked and never suggests unticked cards** (Eren's decision). Cards are grouped. Each is a small fixed-size tile (six per row) with a looping animated preview and a short name; the one-line description shows on hover.

Initial catalogue (per mode; the builder may adjust exact items):

- **Captions (pick one):** word build with newest word yellow (Eren's style) · one big word · small serif with italic emphasis · none.
- **Layout (reel):** full face · split (graphics top, face card bottom) · full graphics · B-roll cutaways.
- **Graphic cards:** rolling number · checklist · bar chart · stamp ("%70 GERİ") · logo pop-ins (official assets) · numbered list (grows) · typed title · title card per item · follow-button outro.
- **App video moments:** phone frame rise · typed amount · tap + selected state · list row drop-in · counter · progress rings · calendar cascade · story card · 3D screenshot fan.
- **Sound & finish:** SFX on visible actions · music bed · soft punch-ins (max 2) · thumbnail/cover.

**Music (optional, via the "music bed" card).** If ticked, Claude does what it did for prao:
- It searches royalty-free libraries (for example Pixabay Music) for 3–4 tracks that fit the video's mood. "Premium / Apple-style" means minimal modern electronic with a clear build, not upbeat stock "corporate happy" music.
- It shows them in the app with a one-line reason each and a playable preview. The user picks one, or asks for others.
- Claude fetches the chosen file into `inputs/music/` and records its source and licence notes (for example "registered with YouTube Content ID").
- Claude analyses tempo, beat phase and drop, offsets the start so the drop lands on the reveal, and keeps the music well under the SFX.

The user may also upload their own track instead. If the card isn't ticked, there's no music.

Each card is a parameterised component in the renderer (HTML/GSAP template), with a matching SFX family. Picking cards narrows what Claude may put in `plan.json`; the app validates the plan against the selection.

## 7. Files: the single source of truth

```
workspace/<project>/
  project.json            mode, preset, ratios, language, option-card selection
  inputs/                 user files (clips, VO, screenshots, music) – never modified
  analysis/               probes, contact sheets, transcripts, reference style specs
  transcript.json         words + timestamps; user-corrected text (reel)
  versions/
    v1/
      plan.json           storyboard + timeline (see below)
      scenes/*.html       Claude-authored scene code where needed (app video)
      render/<ratio>.mp4  + thumbnail
      qa.json             QA gate results
      origin.json         who made it (claude | user), the request or edit diff, parent version
    v2/ …
  preferences.json        learned rules for this user (shared across projects; see §9)
```

`plan.json` is the contract between Claude, direct edits and the renderer. It holds scenes, each with time range, spoken text, shots (source, in-point, duration), cards (type, params, in/out), captions, SFX cues, music offset/volume, per-ratio layout overrides, and a **`why`** string. **All times are authored in seconds** (as in the reel doc), so the plan is fps-independent. The renderer turns `plan.json` + card templates (+ `scenes/*.html` for app video) into the composition **deterministically, without Claude**. That's what makes direct edits instant.

## 8. Editing and versions

- **Direct edits** (no Claude involved): reorder/trim scenes, swap a shot or in-point, fix caption words, change a card's text/number/timing, nudge SFX, music offset/volume, switch ratio. The preview updates live in the browser (no MP4 render). Saving creates a new version with `origin: user` and the diff.
- **Requests to Claude**: free text per scene or for the whole video ("Fooocus part a bit longer", "music too loud"). Claude edits `plan.json` (and scene code if needed) and writes a short summary of what changed. This also creates a new version.
- **Claude sees manual edits**: the diffs of user versions since its last run go into its next run as signals.
- **Limit in app-video mode**: hand-editing covers text, numbers, colours, timings and audio. Changing an animation itself goes through Claude, because scene code is bespoke.
- **Render** is explicit ("Approve & render"). It produces MP4s for every selected ratio, the thumbnail, and QA results. The user can compare any two versions.

## 9. Defaults and learned preferences

- The rules in each reference doc (reel §9, prao §6, §7 and §9) become **preset defaults**, not global ones. Eren's faceless rules (calm 2–4 s shots, no colour changes, fade-only captions, safe margins) are the faceless preset's defaults. The talking-head preset has its own (for example, punch-ins on emphasis are normal there).
- **Global hard rules** for every mode: never grade or alter footage colour; export BT.709 TV range; loudness to −14 LUFS (reels); no whoosh/friction SFX; music is optional and, when used, picked by the user from Claude's suggestions; always deliver a thumbnail/poster; poster baked into frame 0 for app videos.
- **Feedback learning:** when feedback states a lasting preference ("too many cuts", "list too far left"), Claude proposes adding it to `preferences.json`. The user confirms, and it becomes a default for their next projects. Preferences are visible and editable in Settings.

## 10. Aspect ratios

Picked at project creation, changeable later. There's one storyboard; each scene stores per-ratio layout (positions, sizes, safe zones), so a scene is **recomposed, not cropped**. The preview has ratio tabs. Safe zones per ratio follow the reel doc (Instagram UI margins, thumbnail centre band). Talking-head footage that needs reframing keeps the face in frame (approach is the builder's call).

## 11. Screens and UI

Approved mockup: `docs/superpowers/specs/mockups/storyboard-and-option-cards.html` (v2). Eren chose the **storyboard-centred** workspace over a timeline-centred editor.

- **Look:** follows erens.website's light theme:
  - background `#F7FBF9` (no dot pattern), ink `#111827`, muted `#6B7280`, lines `#E8ECEA`;
  - brand green `#3ECF8E` / dark `#1F9D6E`, a green top bar;
  - **Silkscreen** for headings, **JetBrains Mono** for labels/buttons/meta, **Nunito** for body;
  - white cards, 14–18 px radius.
- **Not wanted:** dark mode, dot backgrounds, macOS window-button decorations, crowded cards.
- **Keep it airy:** one line per scene, small icons instead of tag soup, details (Claude's reason, actions) only on the selected scene, generous spacing.
- **Screens:**
  1. **Setup:** dependency and Claude login checks.
  2. **Projects:** list plus "new project".
  3. **New project:** pick the mode/preset, add inputs, ratios, reference reels.
  4. **Option cards:** "Editini kur" / "Build your edit".
  5. **Transcript check (reel):** correct Whisper's words; timings are kept.
  6. **Storyboard workspace:** a progress bar (Footage › Transcript › Storyboard › Render › Review), scene cards, a sticky preview with ratio tabs, Claude's "why" for the selected scene, an "ask Claude" box, a version picker, Approve & render.
  7. **Review:** play renders, QA summary, compare versions, give feedback.
  8. **Settings:** language, learned preferences, paths.
- **Long runs:** analysis and rendering take minutes, so show a live step list driven by Claude's stream (the "Opening…/Transcribing…" style), never a frozen spinner.
- **Languages:** TR/EN toggle in the top bar. Strings live in `lib/i18n/{tr,en}` like marketiyo. Claude replies in the chosen language, and captions follow the footage's spoken language.

## 12. QA gates (every render)

Carried from both docs:
- **Format:** fps, frame count, BT.709 TV range, duration.
- **Loudness:** integrated LUFS and true peak; for app videos, music-only vs SFX levels.
- **Colour:** signalstats luma comparison of render vs raw footage.
- **Layout:** HyperFrames lint/check (if HyperFrames), text contrast.
- **Visual:** a contact sheet of the render that Claude reads to confirm every shot, card and caption is where the plan says.

Failures show in Review with Claude's proposed fix.

## 13. Talking-head reference findings (from this session's analysis)

- **@onur.builds (60 s, one continuous take, only one hard cut).**
  - Face full-screen, then it shrinks to a rounded card bottom-centre while animated cards fill the top on a beige background.
  - Cards are tied to speech: a ₺ counter rolling to 1.000.000, a "%70 GERİ" stamp, a typed "Dijital Ürün Tanıtım Desteği", a checklist ticking Google/Meta/Unity/TikTok/Apple Ads/Influencer, a %50/%70 bar chart, flags.
  - Graphics sometimes go full-screen.
  - Single-word yellow captions with a dark outline.
- **@msevimli_ (37 s).**
  - Face plus quick B-roll intro with a serif series title ("30 günde claude 7. gün").
  - Middle section is illustrated line-art scenes and mock app windows, with no face.
  - Outro is real footage plus an animated "Takip Et → Takip Ediliyor" button.
  - Small single-word captions, with serif italic for emphasis.
- **Takeaway:** this style is the reel pipeline's word timing plus the app-video pipeline's animated cards over or beside footage. That's why both modes share one renderer and one card library.

## 14. Decided by Eren vs left to the builder

**Eren decided:** the two modes; talking head in v1 with its own spike and quality bar, judged against the reference reels (no recording by Eren); music optional, with Claude suggesting tracks and the user picking; fresh skills at least as good as /brag; support for other creators' styles (talking head) beyond his own; the storyboard-centred workspace; both direct editing and Claude requests; option cards, with Claude sticking strictly to the selection; multiple ratios for app videos (extended to reels as my call); TR/EN; the erens.website light theme; less text and more space; the Claude subscription via the local CLI.

**My calls (open to Eren's correction):**
- marketiyo-style local app and file workspace;
- the skills split in §5;
- HyperFrames preferred, decided by the colour spike;
- the `plan.json` contract and the deterministic compiler;
- the version folder layout;
- preferences confirmed by the user before they're saved;
- multiple ratios for reels too;
- the option-card catalogue;
- the preset defaults vs global rules split;
- the placeholder name.

**Left to the builder:**
- exact CLI flags and tool allowlist;
- the plan.json schema details;
- the card template implementation;
- face-aware reframing method;
- dead-air trimming thresholds;
- preview implementation details;
- test strategy;
- how the skills are versioned and updated.
