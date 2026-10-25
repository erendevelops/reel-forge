---
name: reel-talking-head
description: Plan a talking-head reel with explainer graphics, topic logos and custom animations (Reelforge preset talking-head). Load after video-core in analyse, plan and revise stages.
---

# reel-talking-head

A person talks to camera. The camera audio is the voice. The edit lives in the **graphics**: every claim, number,
product and idea gets something on screen, timed to the word, while the layout moves between the face and the
graphics. The quality bar is the @onur.builds and @msevimli_ reels (spec §13).

Eren's verdict on the first test ("lacks a lot of motion and assets, too close to the face") gave this skill three
non-negotiables:

1. **Something visual changes at least every 1.5–2.5 s while someone is speaking.** `rf gaps` must return `[]` before `rf save`.
2. **Every named product gets its real logo, and every idea gets a visual.** Topic assets are on by default.
3. **Never zoom into the face.** Use the widest crop the ratio allows; never crop tighter, and no punch-ins unless ticked.

## Analyse

Follow [references/analyse.md](references/analyse.md). Results: `analysis/transcript.json`, `analysis/trims.json`,
`analysis/face-<ratio>.json`, `analysis/topics.json`, and the working clips under `inputs/work/`.

## Plan

Follow [references/plan.md](references/plan.md) and [references/graphics.md](references/graphics.md).
Gate: `rf validate plan.json` returns no errors **and** `rf gaps plan.json` returns `[]`, then
`rf save plan.json --request "first cut"` (`rf save` refuses talking-head plans with gaps anyway).

## Revise

Same as the other presets: `rf project`, edit, validate, gaps `[]`, then `rf save plan.json --parent <n> --request "<what changed>"`.
