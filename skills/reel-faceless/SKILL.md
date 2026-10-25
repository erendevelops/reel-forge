---
name: reel-faceless
description: Plan a faceless reel cut from B-roll footage over a separate voiceover (Reelforge preset faceless). Load after video-core in analyse, plan and revise stages.
---

# reel-faceless

A faceless reel is B-roll (desk shots, screen recordings, product footage) cut to a separate voiceover. The
**spoken words are the clock**: every cut, card, list item and caption lands on a word timestamp. Eren's 32 s
"5 free AI tools" reel is the reference: [../video-core/examples/plan-faceless-v5.json](../video-core/examples/plan-faceless-v5.json).

## Analyse

Follow [references/analyse.md](references/analyse.md). It ends with these files:

- `analysis/clips.json`: what is in every clip, and its best moments.
- `analysis/transcript.json` and `analysis/transcript-review.json`: words + times for the user to correct.
- `analysis/style.md`: only when reference reels were given.

## Plan

Follow [references/plan.md](references/plan.md) with the defaults in [references/style.md](references/style.md).
Gate: `rf validate plan.json` returns no errors, then `rf save plan.json --request "first cut"`.

## Revise

Read the latest plan (`rf project`), apply the request, keep everything else identical, `rf validate`, then
`rf save plan.json --parent <n> --request "<what changed>"`. Hand edits the user made are listed in the prompt. Keep
them, and learn from them.
