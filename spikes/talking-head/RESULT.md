# Spike B: talking head

Verdict: pending Eren's review

Run on 2026-10-25 (Windows 11, ffmpeg 8.1, faster-whisper medium, hyperframes-layered). Reproduce with:

```
npx tsx spikes/talking-head/run.ts analyse   # transcribe, trims, quietCuts, face track, crop paths, working clips, voice
npx tsx spikes/talking-head/run.ts render    # validatePlan, renderLayered 9:16, qa
```

The scope was cut by the user for speed:
- **Rendered:** 9:16 only.
- **Deferred:** the 4:5 and 1:1 renders. Their crop paths and working clips were already prepared by `analyse` (`assets-4x5/`, `assets-1x1/`).
- **Dropped:** the extra §4.1 evidence (per-cut click measurements, per-ratio containment analysis, card-vs-word table, reference side-by-side PNGs). Eren judges these by eye.

## Deliverable

`../tbd-spike-media/spike-b/talking-9x16.mp4` is 54.8 s long (3288 frames at 60 fps, 1080×1920). Its contact sheet is at `talking-9x16.mp4.sheet.jpg` (2 fps).

## Excerpt and analysis

- **Clip:** source 0–57 s of the Trent Peek clip (see SOURCES.md), transcribed in English with Whisper medium.
- **Trims:** `planTrims` (maxGap 0.30, pad 0.08, retake [0, 1.4] removes the greeting), then `quietCuts` (new, see below), then `renderTrimmedTake`.
  - Kept ranges: 1.52–8.52, 8.52–14.20, 14.24–31.84 and 32.08–56.60.
  - The first two ranges touch, so there are 2 audible joins: about 0.04 s and 0.24 s removed.
- **Few cuts:** Whisper folds most pauses into the next word, so the transcript shows few gaps over 0.3 s. This excerpt also has no stumble. The only retake used is the greeting removal.
- **Face track:** 479 boxes at 10 Hz. There are three gaps where the source cuts away and the face can't be detected (6.8–7.8 walk-in, 14.7–17.0 back-of-head shot, 42.8–46.7 dark-room cutaway).
- **Plan around the gaps:** the full-graphics beat covers the dark-room cutaway, and the outro starts once the face is back.
- **Crop and face position:** the 9:16 crop is 404×720 and follows the face over x 346–529. `Scene.facePos` comes from the median of the track per scene.

## Plan (`plan.json`)

| Scene | Time | What's on screen |
|---|---|---|
| hook | 0–7.0 s | Full face, no cards |
| explain | 7.0–30.3 s | Split layout with two cards (below) |
| story | 30.3–43.2 s | Split layout with two cards (below) |
| beat | 43.2–46.6 s | Full graphics: typed title "Fear of judgment" (label "Most of all") over the source's faceless cutaway |
| outro | 46.6–54.8 s | Full face, `follow-outro` card "@benettgraezer" (illustrative) at 52.1 s on "and" |

Cards in the split scenes, with the spoken word each is tied to:
- **explain:**
  - Checklist "Look natural on camera / Connect with your audience / Videos look way better". The card enters on "practice," at 14.18 s and the ticks land on "natural" 15.92, "connect" 17.72 and "better" 23.78.
  - Rolling number "5 TIPS" on the spoken "5" at 25.72 s.
- **story:**
  - Rolling number "1 YEAR" on "year" at 34.42 s.
  - Stamp "NERVOUS" on "nervous" at 38.16 s.

Captions are word-build, built straight from the remapped transcript words: up to 4 words per group, breaking on punctuation or a gap over 0.25 s. There are 10 SFX cues, one on every card entry, tick and follow press. `validatePlan` passes.

## QA (`talking-9x16.qa.json`): PASS

| Check | Result |
|---|---|
| format | PASS: 60 fps, 3288 frames, 54.8 s, 1080×1920, tv / bt709 ×3, yuv420p |
| loudness | PASS: −14.06 LUFS, −1.97 dBTP |
| footage luma (lossless base track, full-face refs at 2.415, 5.035, 49.375 and 52.475 s) | PASS: Δ 0.000 on all 4 |

## Core changes made for this spike (separate commit)

1. **Layered path now supports talking-head layouts.** Before, `buildBase` ignored `layout`, so split, full-graphics and the face card only existed on the HyperFrames-only path. Now:
   - **Footage (ffmpeg):** the footage is cover-scaled into the face rect (lanczos, per frame) and placed with `object-position` = facePos.
   - **Tween:** the face rect follows the same 0.4 s expo.out tween as the HTML `#face`.
   - **Overlay (HyperFrames):** the overlay paints the beige panel around the rounded face card (`#face-hole`, a box-shadow spread). In full-graphics, `#layout-cover` covers the whole frame.
   - **Full-face scenes:** untouched and bit-exact (Δ 0.000 above).
2. **`quietCuts`** (lib/talking/trim.ts, with 3 tests): moves each cut to the quietest point on the frame grid nearby, up to 0.12 s outward into the pause or 0.08 s inward. Whisper's word edges were measured 30–150 ms off the audio. Without this, the take started inside the decaying tail of "people?" (−17 dB at the cut).
3. **Full-face cards** sit in a bottom band (from 0.78 H down) instead of being centred over the face.
4. **Layered audio** resolves `sfx/...` from the bundled `assets/`, the same way compile does. Before this, the render failed when the assets dir didn't contain the SFX.

## Known issues for review

- **Captions in the full-graphics beat** are white on the beige panel and barely readable. They need a dark caption variant when the panel is up.
- **Untested core paths:** the layered layout path and the full-face card band have no dedicated tests yet. The talking-cards and layered test files weren't re-run, at the user's request for speed.
- **Source cutaways:** the source's own edit cuts to wide or side angles inside the split scenes. The face card shows those shots as the source has them.
