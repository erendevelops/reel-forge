DECISION: hyperframes-layered

# Follow-up round (2026-10-25): layered path re-run after the fixes

`npx tsx spikes/faceless-reel/run.ts` now runs only the layered path by default; `--single` adds the single path back. Output: `MEDIA/spike-a/layered-v2.mp4`.

**What changed**
- Luma gate measures footage only. The layered path checks the lossless base track (`QaExpect.lumaFile`, which `renderLayered` returns as `base`). There's also an optional `lumaRegion` crop.
- Loudness is two-pass and linear, targeting TP −2.0 internally.
- The composite is encoded at CRF 10, preset slow.
- The punch-in uses the actual v5 spring curve, from one shared definition in `lib/compile/punch.ts`.
- Captions:
  - Spacing: no whitespace between the inline-block words, so the gap is only the 9 px margins.
  - Only spoken words are laid out, so the line re-centres as words arrive, like v5.
  - The words are v5's punctuated `GROUPS`.
- Tool icons: Whisper uses contain at a 62 % inset; Fooocus uses cover at `object-position: 25% 20%`.

| | first round (layered) | **v2 (layered)** | v5 Remotion |
|---|---|---|---|
| luma gate (footage) | n/a (whole frame: FAIL 3/12) | **PASS 12/12** on base.mkv: 0.000 on 7 refs, ±0.20 on 4 between-frame refs, +2.544 on s10 (punch-in, scaled frame) | n/a (whole frame: FAIL 3/12) |
| loudness I / TP | −14.28 LUFS / −1.42 dBTP (FAIL) | **−14.26 LUFS / −1.92 dBTP (PASS)** | −14.28 / −1.44 (FAIL) |
| size / bitrate | 360 MB / 89.9 Mb/s (CRF 4) | **161.6 MB / 40.3 Mb/s (CRF 10)** | 155 MB / 38.8 Mb/s |
| render time | 241.8 s | **229.1 s** (an earlier v2 run took 322.6 s while the test suite was using the CPU) | 131 s |
| format | PASS | PASS (60 fps, 1920 frames, 32.000 s, tv/bt709 ×3, yuv420p) | PASS |

The whole-frame composite luma is informational only, since overlays are included. It now tracks v5 closely: Δ −3.58 / +3.22 / +3.93 against v5's −3.52 / +4.12 / +4.50 at 1.89 / 19.18 / 23.94 s. The s10 value got closer because the punch now follows v5's curve.

**Punch-in.** Remotion's `spring()` (`spring-utils.js`) has only under-damped and critically-damped branches. With ζ ≈ 1.83 it uses the critically-damped one:
- The curve is x(t) = 1 − e^(−ωt)(1 + ωt), with ω = √120. Checked against v5's `spring()`: 0.299 @ 0.1 s, 0.758 @ 0.25 s, 0.973 @ 0.5 s.
- It settles to within 1e-3 in 0.845 s (51 frames), so it is *faster* than the old power2.out/1.2 s ease, not slower. The first round's by-eye "ours stronger" didn't hold up.
- Our base track measured scale 1.0239 at τ = 0.1 s, which matches.
- Side-by-side footage frames aren't the same instant in v5. Even at t = 3.2, where both are settled at 1.08, the PSNR of ours vs v5 is only about 14 dB, with different hand positions. So v5's Remotion video frames are offset from the timeline, and punch timing can't be compared by eye from those PNGs.

**Images (left = ours v2 layered, right = v5)**
- `MEDIA/spike-a/compare-{punch-2.6s,hook-cards-2.9s,whisper-card-11.5s,list-whisper-13s,title-card-7.1s,list-21.5s,cta-30.5s}-layered-vs-v5-v2.png`
- `MEDIA/spike-a/shot06-raw-vs-layered-v2.png`
- `MEDIA/spike-a/layered-v2.mp4.sheet.jpg`

Captions ("İkinci, Whisper.", centring, spacing, wrapping at 21.5 s), the Whisper tile inset and the Fooocus crop now match v5.

**Remaining look differences**
1. During the Whisper title card (11.5 s), v5 still shows the list ("1. Fooocus"); ours doesn't. The fixture's first list card ends at 10.66 and the next starts at 11.9167. This is a plan-timing difference, not a template one.
2. There's no whoosh, by design.
3. v5's Upscayl/VoiceStudio tiles have no drop shadow (the image is the tile). Ours keep the shadow, which is minor.

---

# First round


# Spike A: faceless reel colour test

Run on 2026-10-25 (Windows 11, hyperframes@0.8.191, ffmpeg 8.1). Commands:

```
npx tsx spikes/faceless-reel/run.ts                 # single path; layered ran automatically (a luma check failed)
npx tsx spikes/faceless-reel/run.ts --footage-only  # diagnostic: same plan, no cards/captions
```

All media is outside the repo, in `C:/Users/eaygu/OneDrive/Masaüstü/Projects/tbd-spike-media/` (written `MEDIA/` below).

## Why layered (short version)

- **Single path changes the footage.** With no overlays at all, the single path renders every shot **about 1.1 Y darker** than its working clip (Δ −0.99 to −1.35 on 11 of 12 refs). It also lifts blacks (YMIN 3 → 10) and clips superwhites (YMAX 249 → 240). Y PSNR against the source is 43.4 dB. The shift stays inside the ±3 gate and you can't see it side by side. It's still a systematic change to footage colour, and the constraints say "never alter footage colour".
- **Layered path leaves the footage bit-exact.** Its footage-only base track measures **Δ 0.000** wherever no punch-in applies.
- **Neither full render passes the literal luma gate, and v5 doesn't either.** The gate compares whole-frame yavg, so cards and captions over the footage move the number. The worst case is t=1.89, where three hook cards cover about 17 % of the frame. The single render fails 1 of 12 refs, layered fails 3 of 12, and the **v5 Remotion reference fails 3 of 12, with a larger worst case (+4.50)**. The failures come from overlay pixels, not from footage colour, so `DECISION: remotion` would fix nothing. Read strictly, brief step 4 says "both fail → remotion". I'm overruling that reading for the reason above, and the controller should confirm.

## Plan used (`plan.json`)

This is a copy of `tests/fixtures/plan-reel-v5.json` with two kinds of change. Both are needed to render against `../video/reel/public`:

1. **Shot in-points.** The fixture's `from`/`to` are the RAW-clip in-points from the reel doc §5 (e.g. s01 12.0, s12 221.0). `public/sNN.mp4` are the pre-trimmed v5 working clips. Each starts at the shot's first frame and is shot length + ~0.3 s long (probed: s01 4.117 s for a 3.78 s shot … s12 4.100 s for 3.80 s). v5's `Reel.tsx` also plays every clip from 0. So every shot became `from: 0, to: <shot duration>`. `at` and `punch` (timeline seconds) are unchanged.
2. **Asset names.** The fixture names placeholder images that don't exist in `public/ext` (`ext/openai.png`, `claude.png`, `gemini.png`, `github.png`, `fooocus.png`, …). They were swapped for the files v5 actually uses:
   - Hook pops: the four v5 `CARDS` (`fooocus_1.png`, `upscayl_banner.jpg`, `bu_logo_white.png`, `voice_logo.png`), with v5's left/top/width/height/rot/fit/bg.
   - Tool logos: `fooocus_1.png`, `openai_white.svg` (Whisper), `upscayl_icon.png`, `bu_symbol.png`, `voice_logo.png`.

Everything else is unchanged from the fixture: card timings, captions, SFX cues (no whoosh) and the voice. The v5 reference does play `whoosh.wav` on its title cards; ours has none.

## v5 reference

`../video/output/` was empty. Following the controller ruling, I rendered the original composition from `../video/reel`. That project's files weren't modified; its `git status` was the same before and after.

```
npx remotion render Reel MEDIA/v5-raw.mp4 --codec=h264 --crf=10 --color-space=bt709 --audio-bitrate=320k   # 131 s wall
ffmpeg -i v5-raw.mp4 -c:v copy -af "loudnorm=I=-14:TP=-1.5:LRA=11" -ar 48000 -c:a aac -b:a 320k -movflags +faststart v5-reference.mp4
```

## Render times

| path | time | output |
|---|---|---|
| single | compile 0.17 s + HyperFrames render **169.7 s** + loudness finish 4.0 s | `MEDIA/spike-a/single.mp4` (79 MB, 19.8 Mb/s) |
| layered | **241.8 s** total (base + mix + overlay render + composite + finish) | `MEDIA/spike-a/layered.mp4` (360 MB, 89.9 Mb/s, composite CRF 4) |
| v5 Remotion | 131 s | `MEDIA/v5-reference.mp4` (155 MB, 38.8 Mb/s) |

## QA, every check value

Expected: 60 fps, 1920 frames, 32.000 s, 1080×1920, yuv420p, tv, bt709 ×3, −14 LUFS ±1, TP ≤ −1.5, luma |Δ| ≤ 3.
Luma refs are at each shot's midpoint (source t = midpoint − at + from), against `public/sNN.mp4`. The full reports are `MEDIA/spike-a/{single,layered,v5-reference}.qa.json`.

**format** passes on all three: `{"fps":60,"frames":1920,"w":1080,"h":1920,"range":"tv","dur":{"container":32,"video":32},"primaries":"bt709","space":"bt709","trc":"bt709","pix":"yuv420p"}`

**loudness** fails on all three, on true peak only:

| file | I (LUFS) | TP (dBTP) |
|---|---|---|
| single | −14.27 | **−1.41** |
| layered | −14.28 | **−1.42** |
| v5-reference | −14.28 | **−1.44** |

This comes from `finishLoudness` (single-pass loudnorm plus AAC overshoot; deferred minor from Task 3). The reel doc's own §8.2 command produces the same result on v5, so it says nothing about the renderer.

**luma** (Δ = output yavg − source yavg; a bold value fails):

| outT | shot | source | single | layered | v5 | footage-only single | layered base (footage only) |
|---|---|---|---|---|---|---|---|
| 1.89 | s01 (3 hook cards) | 92.041 | **−4.130** | **−3.316** | **−3.515** | −1.014 | 0.000 |
| 4.97 | s02 | 42.498 | +0.744 | +1.864 | +1.976 | −1.129 | 0.000 |
| 7.50 | s03 | 67.721 | −0.766 | +0.433 | +0.247 | −0.989 | +0.201¹ |
| 9.75 | s04 | 71.680 | +0.433 | +1.613 | +1.544 | −1.194 | 0.000 |
| 12.43 | s05 | 62.916 | +0.611 | +1.770 | +1.773 | −1.345 | −0.170¹ |
| 15.21 | s06 | 61.549 | +1.046 | +2.220 | +2.781 | −1.204 | 0.000 |
| 17.12 | s07 | 73.571 | +0.396 | +1.545 | +1.454 | −1.142 | +0.019¹ |
| 19.18 | s08 | 57.331 | +1.989 | **+3.141** | **+4.119** | −1.133 | 0.000 |
| 21.52 | s09 | 65.172 | +1.906 | +2.940 | +2.821 | −1.182 | −0.133¹ |
| 23.94 | s10 (punch-in) | 66.488 | +1.939 | **+3.491** | **+4.502** | +0.308² | +2.139² |
| 26.69 | s11 | 64.243 | +1.577 | +2.749 | +2.181 | −1.209 | 0.000 |
| 30.10 | s12 | 87.466 | +0.906 | +1.995 | +2.068 | −1.103 | 0.000 |
| **gate** | | | FAIL (1/12) | FAIL (3/12) | FAIL (3/12) | PASS | PASS |

¹ The ref time falls between frames, so the measured frame is a neighbour. ² The s10 punch-in has scaled the image by this point, so the frame is no longer the source frame.

The full-render columns follow the footage-only columns plus overlay brightness. Single sits about 1.1 below layered/v5 at every ref, which is its footage bias. Layered and v5 agree within about 1 at every ref, which suggests Remotion's footage was also near-exact.

**Single-path shift in detail** (signalstats, footage-only render vs source; values are source → output):

| ref | YMIN | YLOW | YAVG | YHIGH | YMAX |
|---|---|---|---|---|---|
| s05 @12.43 | 9 → 12 | 21 → 20 | 62.99 → 61.67 | 113 → 112 | 240 → 236 |
| s08 @19.18 | 10 → 11 | 20 → 19 | 57.42 → 56.30 | 95 → 93 | 240 → 235 |
| s12 @30.10 | 3 → 10 | 26 → 25 | 87.52 → 86.42 | 155 → 154 | 249 → 240 |

UAVG/VAVG move by +0.1 to +0.2. Y PSNR is 43.4 dB (s05). The pattern is a small darkening with toe/shoulder clamping, consistent with an 8-bit RGB round trip through the browser.

**contactSheet:** `MEDIA/spike-a/single.mp4.sheet.jpg`, `MEDIA/spike-a/layered.mp4.sheet.jpg`, `MEDIA/spike-a/v5-reference.sheet.jpg`, `MEDIA/spike-a/footage-only.mp4.sheet.jpg`. All 12 shots, the 4 hook pops, 5 title cards, the growing list (yellow latest, all white at the CTA) and the word-build captions are in place.

## Side-by-side images

- Shot 6, working clip s06 @1.01 s (left) vs render @15.21 s (right): `MEDIA/spike-a/shot06-raw-vs-single.png`, `MEDIA/spike-a/shot06-raw-vs-layered.png`
- Ours (left) vs v5 Remotion (right), single path: `MEDIA/spike-a/compare-{hook-cards-2.9s,title-card-7.1s,list-21.5s,cta-30.5s}-single-vs-v5.png`
- Ours (left) vs v5 Remotion (right), layered path: `MEDIA/spike-a/compare-{hook-cards-2.9s,title-card-7.1s,list-21.5s,cta-30.5s}-layered-vs-v5.png`. These were made after the run, with the same `hstack` command as `sideBySide()` in run.ts.

## Look differences vs v5 (by eye)

These are template and plan gaps, not colour problems. By eye, the footage colour of single, layered and v5 can't be told apart.

1. **Punch-in timing.** By t=2.9, ours is visibly further zoomed than v5. Our `power2.out` over 1.2 s reaches about 6 % within 0.5 s. v5's spring (damping 40, stiffness 120) is much slower.
2. **Caption word spacing.** Ours is wider, roughly double gaps ("bedava  alternatifleri"), so groups wrap earlier: "yaptırmanızı" drops to a second line at 21.5 s where v5 keeps one line.
3. **Caption text.** The fixture captions have no punctuation ("Birincisi Fooocus" vs v5 "Birincisi, Fooocus.") and its groupings differ slightly from v5's.
4. **Whisper logo tile.** v5 contains the OpenAI mark at 62 % on #0b0b0b. Ours covers the tile edge to edge (no per-tool fit/inset; related to the Task 5 ToolIcon deferred minor).
5. **No whoosh on title cards** (deliberate: the no-whoosh rule).
6. Title cards, list geometry, hook pop sizes and positions, and the yellow highlight all match v5 closely.

## Follow-ups this raises

- **Layered output size.** The composite is CRF 4 (90 Mb/s, 360 MB for 32 s). Delivery needs a sane CRF, e.g. about 10 like v5. That's a one-line change in `renderLayered`, but it touches the encoded footage, so luma should be re-measured after it.
- **True peak.** `finishLoudness` should become two-pass (measured) loudnorm, or target TP −2.0, so it passes the ≤ −1.5 dBTP gate after AAC.
- **Luma gate design.** The gate should measure footage, not the composite: either mask overlay regions, or (for layered) check the base track. As written, it fails v5, the reel we're trying to match.
