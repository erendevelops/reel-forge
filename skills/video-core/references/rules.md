# Rules

## Hard rules (every preset, never broken)

- **Footage colour is never altered.** No grading, LUTs, gradients over footage or flashes. Legibility comes from text shadow and panels only.
- **Only the ticked option cards.** If the right card for a moment isn't ticked, use a ticked one or nothing, and say so in your reply. Never add it.
- **No whoosh or swoosh sounds.** Sound only what is visibly pressed, typed, landing or appearing.
- **Never repetitive** (talking-head and app videos): no sound twice in a row, a logo once, no built-in card template in two scenes in a row or more than twice, no on-screen text that repeats the spoken line. `rf validate` refuses each; [look.md](look.md) says what to do instead.
- **Music is optional and never chosen silently.** If the music card is ticked, suggest 3–4 tracks ([music.md](music.md)); the user picks.
- **Every on-screen claim must be true to the source** (what is said, or what the product actually does). Framing lines are fine; invented facts are not.
- **Never zoom into a face.** Crops are the widest the ratio allows (`rf crop`). Punch-ins only when ticked, and at most 2 per video.
- **Text is UTF-8, always.** When you read or write files with Python, pass `encoding="utf-8"` (`open(path, encoding="utf-8")`, `json.dump(..., ensure_ascii=False)`); never rely on the default, which is the Windows ANSI code page and turns Turkish ı/ş/ğ into `�`. `rf validate` refuses any plan containing `�`.
- **Always write `plan.cover`** when the thumbnail card is ticked ([plan-contract.md](plan-contract.md)): a sharp, settled frame plus a short headline that sells the video. The app draws the cover from it; a bare frame is not a cover.

## Defaults (preset skills refine these; learned preferences override them)

- Calm pacing: 2–4 s shots for faceless reels. Talking heads move constantly, but through graphics, not cuts.
- Captions fade in; the newest word is highlighted; no bouncing.
- Safe margins: UI elements ≥ 100 px from the left edge on 9:16; captions around 68 % of the height; key thumbnail content inside the centre 1080×1350 band.
- Reading time: a line holds about 0.5 s + 0.3 s per word; the last line holds at least 2 s.

## Learned preferences

`CLAUDE.md` and `rf project` list rules the user taught earlier projects ("too many cuts", "list too far left").
They override every preset default. When feedback in a revise request states a **lasting** preference (not a
one-off for this video), end your reply with exactly one line:

```
PREFERENCE: <the rule, in the user's language, one sentence>
```

The app offers to save it for future projects.
