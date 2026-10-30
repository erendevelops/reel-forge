# Plan a faceless reel

Start from `analysis/transcript.json`: the app saves the user's corrections there. Captions use its words **word for word**. `transcript-review.json` is only your list of doubtful words from the analysis; never take caption text from it.

## Scenes and shots

- One scene for the hook, one per list item, one for the CTA. Scene seams sit on the first word of each section.
- **Cuts land on word starts,** usually the first word of a phrase or the tool name.
- **Shots last 2–4 s.** One or two shots per item. A 30 s reel has about 10–14 shots.
- The creator's **signature shot** (for example a wide desk shot) opens and closes the reel.
- Give each item its most **result-like** footage (images appearing, a before/after slider, an agent clicking) rather than README text.
- For each shot, make a working clip: `rf prep inputs/<raw> inputs/work/sNN.mp4 --from <in> --duration <shot + 0.3> --ratio 9:16 --fps 60`. Then reference `work/sNN.mp4` with `from: 0`.
- **Punch-ins** (only if ticked): at most 2 per reel, on an emphasis word ("bedava", "favorim"). No continuous zoom.

## Cards

- **Hook:** logo pop-ins (`logo-pop`) on the first words naming what's coming, scattered in the upper half around the subject. They leave at the first cut.
- **Items:** a `title-card` from the tool-name word to just before the next phrase (about 0.9 s), numbered 1…N, with the tool's official logo ([../../video-core/references/assets.md](../../video-core/references/assets.md)).
- **List:** a `numbered-list` card per scene. Each item lands as its title card leaves (title end − 2 frames). The current item is yellow; at the CTA they all turn white (`highlight: "none"`).
- **Sounds:** a drop per hook card, maximize on every title card, pluck on every list landing ([../../video-core/references/cards.md](../../video-core/references/cards.md)).

## Captions

Groups of 1–5 words. Each group lasts until the next one starts. Use the ticked caption style. For `word-build`,
words accumulate as spoken and only the newest is highlighted.

## Thumbnail (when ticked)

Plan a settled frame, normally a plain frame of the closing shot. Put the hook headline in the scene's `why` so the user can see it.

## Before saving

1. `rf validate plan.json`, and fix every error.
2. Self-check: every claim matches the voiceover, every logo is official, and no shot is shorter than 2 s or longer than 4 s without a reason you can name.
3. `rf save plan.json --request "first cut"`.
