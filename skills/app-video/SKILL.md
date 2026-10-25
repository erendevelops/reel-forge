---
name: app-video
description: Plan a short launch video for an app, rebuilt from the product's own code, UI strings and brand, and animated acting (Reelforge preset app-video). Load after video-core in analyse, plan and revise stages.
---

# app-video

A 15–25 s product film made from the app's own material. The reference is Eren's prao launch video
(`../prao/brag-output-2026-10-24-120841/prao-video-reference.md`). **The UI is rebuilt and animated acting**
(typing, tapping, counters rolling, lists updating) as `custom-animation` cards. The video never pans over
screenshots; real screenshots appear only in the outro.

## Analyse (inspect)

Follow [references/inspect.md](references/inspect.md). Result: `analysis/product.json` (the 9-question rubric,
brand tokens, real copy, the user flow) and, if music is ticked, `analysis/music-candidates.json`.

## Plan

Follow [references/plan.md](references/plan.md) for the storyboard (`analysis/storyboard.md`), then
[references/compose.md](references/compose.md) to turn it into `plan.json`. Tone presets are in [references/tones.md](references/tones.md).
Gate: `rf validate plan.json` returns no errors, then `rf save plan.json --request "first cut"`.

## Revise

`rf project`, edit the affected scenes only, validate, then `rf save plan.json --parent <n> --request "<what changed>"`.
Text, numbers, colours and timings can also be edited by the user by hand; animations are yours.
