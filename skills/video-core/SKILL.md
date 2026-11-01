---
name: video-core
description: Shared rules, plan contract and the rf tool for every Reelforge video project. Load first in any analyse, plan or revise stage, before the preset skill.
---

# video-core

You are planning a video inside a Reelforge project folder. The app renders; you decide. Your output is always a
`plan.json` stored with `rf save`, never a video file.

## The three stages

The app starts you with one of these in the prompt:

| Stage | You do | You finish with |
|---|---|---|
| **analyse** | Inventory `inputs/`, run the preset's analysis steps, write results under `analysis/` | A short summary in the reply. No plan. |
| **plan** | Write `plan.json` from the analysis, using only the ticked option cards | `rf validate` clean, then `rf save plan.json --request "first cut"` |
| **revise** | Start from `latest.plan` in `rf project` (it includes the user's hand edits; write it to `plan.json` first), apply the request | `rf save plan.json --parent <n> --request "<what changed>"` |

The preset skill (`reel-faceless`, `reel-talking-head` or `app-video`) says what "analysis" and "plan" mean for
that kind of video. Read this skill first, then that one.

## Everything mechanical is an `rf` command

`rf` lives in the project folder and is on your PATH (`rf.cmd` on Windows cmd, `rf` in bash). Every command prints one JSON object, and exits 1 with
`{"error": …}` when something is wrong. Read the error, fix the input and run it again. Never work around rf with
your own ffmpeg or Python, unless a preset skill tells you to.

| Command | What it gives you |
|---|---|
| `rf project` | The project (preset, ratios, language, option cards), learned preferences, versions, and `latest.plan` |
| `rf probe <file>` | Duration, size, rotation, fps, colour range, audio |
| `rf sheet <video> <out.jpg> --every <s> [--from <s> --to <s>]` | A timestamped contact sheet to read as an image (much cheaper than frames). Watch references densely: `--every 0.5` in 10 s chunks |
| `rf cuts <video>` | Scene-change times (pacing of a reference reel) |
| `rf transcribe <audio> --lang <tr\|en\|auto> --prompt "<names>"` | Word-level timestamps. Seed `--prompt` with proper nouns |
| `rf prep <src> <out> --from <s> --duration <s> --ratio <r> --fps <30\|60> [--crop <crop.json>]` | A working clip (BT.709, colour untouched) |
| `rf trims <transcript.json>` | Kept ranges after cutting dead air between words |
| `rf trimtake <take> <trims.json> <out.mp4> --transcript <t.json>` | The take with those ranges cut out, plus `analysis/transcript-trimmed.json` re-timed onto it |
| `rf facetrack <video> <out.json>` | Face boxes over time |
| `rf crop <track.json> --ratio <r>` | The widest crop window for the ratio that keeps the face in frame |
| `rf logo <name>` | The official logo of a named product, written into `assets/si/` (or `{found:false}`) |
| `rf fetch <image url> [--name x] [--license "…"]` | A web image into `inputs/ext/` (plan path `ext/x.png`), source logged in `analysis/assets.json` |
| `rf cutout ext/<image> [--out ext/x-cut.png]` | The image with its background removed and border cropped (transparent PNG) |
| `rf beats <audio>` | Tempo, beat times and the drop of a music track |
| `rf validate <plan.json>` | Every contract and selection error in the plan |
| `rf preview <plan.json> --at <s,s,…> [--ratio <r>]` | Stills of the plan at those times (`analysis/preview/contact-sheet.jpg`). Look at your scenes before saving |
| `rf gaps <plan.json>` | Stretches longer than 3 s with nothing visual happening |
| `rf save <plan.json> [--parent <n>] [--request <text>]` | Validates and stores a new version. The app then renders a draft |

## Hard limits

- Never render a video (`rf preview` stills are how you look). Never write outside the project folder. Never modify the user's original files in `inputs/`. Your own files go in `inputs/work/` (working clips) and `inputs/ext/` (downloaded assets).
- Use **only** the option cards listed in `CLAUDE.md` / `rf project`. `rf save` rejects anything else.
- Reply in the project's language (it's in `CLAUDE.md`). Captions follow the *spoken* language of the footage.

## References

- [references/plan-contract.md](references/plan-contract.md): every field of `plan.json`, with a full example.
- [references/rules.md](references/rules.md): hard rules, defaults, preferences.
- [references/look.md](references/look.md): **read before planning a talking-head or app video.** One design kit per video, a new specific graphic per beat, watching references.
- [references/cards.md](references/cards.md): every card type, when to use it, timing and sound.
- [references/sfx.md](references/sfx.md): the 248 bundled sounds by action, and the variety rules.
- [references/assets.md](references/assets.md): logos, external images, and writing a `custom-animation` scene script.
- [references/music.md](references/music.md): suggesting music and aligning to its beats.
- [references/qa.md](references/qa.md): what the app checks, and the one check you do yourself.
