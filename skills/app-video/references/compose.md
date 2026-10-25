# Compose `plan.json`

## Frame

- `mode: "app"`, `fps: 30`, `ratios` from the project (16:9 by default; 9:16 is a recomposed layout, not a crop).
- `look.background` = the brand ground and `look.ink` = the brand ink. Both are required; `rf validate` refuses app plans without `look.background`.
- Every scene is `layout: "full-graphics"` with no shots. The rebuilt UI is the picture.
- `captions.style: "none"` unless the user ticked captions.

## Rebuilt UI = `custom-animation` cards

Each product moment is one or more `custom-animation` cards ([../../video-core/references/assets.md](../../video-core/references/assets.md)
has the fragment rules and two worked examples). Build the real components in HTML/SVG with the brand tokens:
a phone frame, sheets, list rows, cards with counters, rings, calendar grids, story cards. Then animate them acting:

| Action | How (literal `tl` calls) |
|---|---|
| Typing an amount | Stack every text state ("0 ₺", "1 ₺", "18 ₺", "180 ₺") hidden; `tl.set` each visible at its keypress, plus a small scale pop. Never `fromTo` the stacked states (prao bug: all states visible at frame 0) |
| Tap | `scale 1 → 0.88 → 1` plus the real selected state (background and icon colour swap) |
| Counter | Digit columns (a strip of 0–9 twice) moved by `y` to land on each digit, staggered right to left |
| Rings / bars | `stroke-dashoffset` / `scaleX` from 0 to the ratio; switch to the warning colour past the app's own threshold |
| Cascade | Items enter 0.02–0.04 s apart, scale 0.8 → 1 |
| List update | The sheet drops away, existing rows shift down, the new row drops in from above |

**Never pan over screenshots.** Real screenshots appear only in the outro, fanned in 3D behind the logo: one `custom-animation` with an `<img src="ext/<screen>.jpg">` per screenshot (copy them into `inputs/ext/` first), each tweened in with `x`, `rotationY`, `rotationZ` and `y`.

**Several ratios:** pixel positions in a fragment are used exactly as written. Write the 16:9 version in `params`, and a recomposed 9:16 (or 1:1) version in each scene's `ratioOverrides`, e.g. `"ratioOverrides": { "9:16": { "html": "…", "css": "…" } }`.

## Motion rules

- **Arrive slow, leave fast:** entrances 0.4–0.9 s with a long `expo.out` tail; exits 0.2–0.3 s `power3.in`.
- **Titles land and stay dead still.** The motion moves to the UI and the next element; no floating or breathing loops.
- **Vary the entrances:** per-word blur, per-letter fade, number roll, card rise, 3D tilt, whip. Don't repeat the same fade-and-slide every scene.
- **Transitions have a cause:** an object becomes the next scene (chips swirl into the logo, the saved row grows into the next card). Avoid crossfades between two busy layouts.
- **Overlap:** the next element starts when the previous is about a third done.

## Sound (SFX on every visible action; never whooshes)

| Action | Family (bundled under `sfx/`) | Volume |
|---|---|---|
| Typing | key ticks (`drop_001` at low volume if no key sounds are bundled) | 0.5 |
| Tap / save | `drop_002` | 0.55 |
| Card / row lands | `drop_003` | 0.5 |
| Reveal / logo lands | `maximize_006` | 0.5 |
| Outro | `drop_004` | 0.5 |

Fire each sound at the **start** of its motion. Nothing is louder than the music's peaks.

## Before saving

`rf validate plan.json` (fragment errors name the card and the line), then `rf save plan.json --request "first cut"`.
