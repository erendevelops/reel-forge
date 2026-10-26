# Compose `plan.json`

## Frame

- `mode: "app"`, `fps: 30`, `ratios` from the project (16:9 by default; 9:16 is a recomposed layout, not a crop).
- `look.background` = the brand ground and `look.ink` = the brand ink. Both are required; `rf validate` refuses app plans without `look.background`.
- Every scene is `layout: "full-graphics"` with no shots. The rebuilt UI is the picture.
- `captions.style: "none"` unless the user ticked captions.

## Rebuilt UI = scene scripts in the app's own design

Each product moment is a `custom-animation` scene with a script ([../../video-core/references/assets.md](../../video-core/references/assets.md)).
**Fidelity first:** before writing a scene, open the component it rebuilds (the add sheet, the list row, the budget
card…) and copy its real values: background and border colours, radius, padding, font sizes and weights, icon SVG
paths, the exact strings, the number format. Then scale the whole component up uniformly so it reads on video (a
phone screen is drawn ~1.6× its points). A scene that "looks like an app" but not like *this* app is wrong.

`plan.look` = the app's tokens (ground, surface as `card`, ink, secondary as `muted`, accent, success/danger as
`positive`/`negative`, radius, font). Scenes use `var(--…)` so they match each other and the app.

Vary the scenes, the real prao video is the bar ([prao.md](prao.md)): no two scenes share a layout or an entrance.

| Action | How (scene script) |
|---|---|
| Typing an amount | `type()` the digits into the amount label, a small scale pop per key; the keypad key under the finger flashes (`tl.fromTo(key, {scale:1}, {scale:0.88})` then back) |
| Tap | scale 1 → 0.88 → 1 plus the real selected state (background and icon colour swap via `tl.set`) |
| Counter | `count()` with the app's number format, or digit columns rolling (see `rolling-number`) for the hook |
| Rings / bars | `strokeDashoffset` / `scaleX` from 0 to the ratio; swap to the app's warning colour past its own threshold |
| Cascade | items built in a loop, entering 0.02–0.04 s apart, scale 0.8 → 1, positions from a grid |
| Scatter / gather | chips placed with `rand()` around the centre, then tweened into place (or into the logo) |
| List update | the sheet drops away, rows shift down, the new row drops in from above |
| Calendar | a loop builds the month grid; days fill in colour one by one; a streak counter `count()`s |
| Story / recap card | progress segments fill, the total counts, the detail lines rise in |

**Never pan over screenshots.** Real screenshots appear only in the outro, fanned in 3D behind the logo
(`<img src="ext/<screen>.jpg">` per screenshot, tweened with `x`, `rotationY`, `rotationZ`, `y`).

**Several ratios:** write the 16:9 version in `params`, and a recomposed 9:16 (or 1:1) in each scene's
`ratioOverrides` (`html`/`css`/`script`). 16:9 usually puts the headline left and the UI right; 9:16 stacks them.

## Motion rules

- **Arrive slow, leave fast:** entrances 0.4–0.9 s with a long `expo.out` tail; exits 0.2–0.3 s `power3.in`.
- **Headlines land and stay dead still**; the UI acts beside them.
- **Each scene has its own entrance:** number blur-roll, chip scatter, logo build, phone rise, card count-up, grid fill, story card, 3D screenshot fan. Never the same fade-and-slide twice.
- **Transitions have a cause:** an object becomes the next scene (chips gather into the logo, the saved row grows into the next card).
- **Overlap:** the next element starts when the previous is about a third done.

## Sound

One sound per visible action, matched to it ([../../video-core/references/sfx.md](../../video-core/references/sfx.md)):
keypresses per typed digit, clicks for taps, card slides for sheets, chips for money landing and counters, a bell or
soft impact for the logo, card-fan for the screenshot fan. prao's real video used 33 different cues in 23 s.
Fire each at the start of its motion. Nothing louder than the music's peaks.

## Before saving

`rf validate plan.json` (fragment errors name the card and the line), then `rf save plan.json --request "first cut"`.
