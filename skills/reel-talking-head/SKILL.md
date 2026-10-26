---
name: reel-talking-head
description: Plan a talking-head reel with explainer graphics built for every beat, topic logos and custom scenes (Reelforge preset talking-head). Load after video-core in analyse, plan and revise stages.
---

# reel-talking-head

A person talks to camera. The camera audio is the voice. The edit lives in the **graphics**: every number, list,
comparison, rule, product and idea gets its own designed visual, built on the word, while the layout moves between
the face and the graphics. The quality bar is the @onur.builds and @msevimli_ reels.

Eren's verdicts set the non-negotiables:

1. **Unique and specific, never repetitive.** The first draft repeated the same typed-title, the same YouTube logo and the same drop sound for 54 s and was rejected. Every beat is a different graphic made for that sentence, in one consistent look ([../video-core/references/look.md](../video-core/references/look.md)). `rf validate` refuses repeats.
2. **Lots of motion, all of it meaningful.** No stretch of talk over 3 s without a visible beat (`rf gaps` must be `[]`), but the beats come from graphics building up (rows joining, values counting, stamps landing), not from filler cards.
3. **Never zoom into the face.** The face is either full frame (widest crop the ratio allows) or the wide 4:3 face card under the graphics. No punch-ins unless ticked.

## Analyse

Follow [references/analyse.md](references/analyse.md). Results: `analysis/transcript-trimmed.json`, the face track and
crops, the working clips, `analysis/beats.md` (what to draw per sentence) and `analysis/kit.md`.

## Plan

Follow [references/plan.md](references/plan.md) and [references/graphics.md](references/graphics.md).
Gate: `rf validate plan.json` returns no errors **and** `rf gaps plan.json` returns `[]`, then `rf save plan.json --request "first cut"`.

## Revise

`rf project`, edit, validate, gaps `[]`, then `rf save plan.json --parent <n> --request "<what changed>"`.
