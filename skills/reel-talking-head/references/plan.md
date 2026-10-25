# Plan a talking-head reel

## Layout rhythm

The default shape (adapt it to the talk):

| Part | Layout | What happens |
|---|---|---|
| Hook (0–3 s) | `full-face` | The strongest line; a stamp or number lands on its key word |
| Body | `split` (graphics top, face card bottom) | One card per claim, number or product, entering on its word |
| One beat in the middle | `full-graphics` | The face hides for 2–4 s while a `custom-animation` or a big number carries the idea |
| Outro | `full-face` | Call to action + `follow-outro` with the creator's handle |

Switch layouts on sentence boundaries, not mid-word. Each switch counts as a visual change.

## Motion density, the rule that failed in the first test

While someone speaks, **something visual changes every 1.5–2.5 s**: a card entering, a checklist tick, a list row,
a logo pop, a layout switch, or a beat inside a `custom-animation`. Walk the transcript in 2 s windows. If a window
has nothing, add something tied to a word in it:

1. a product name → its logo (`logo-pop`, or the logo in a `title-card`);
2. a number → `rolling-number`;
3. a list → `checklist`, one tick per item;
4. a contrast → `bar-chart`;
5. a punchline → `stamp`;
6. a term or name → `typed-title`;
7. an idea with no logo → a `custom-animation` (a flow, a before/after, a small simulation).

Then run `rf gaps plan.json`. It must return `[]` before `rf save`. A save with gaps is refused.

## Topics → assets

Every item in `analysis/topics.json` should appear on screen near its `at` (±0.1 s of the word):

- `product` → official logo via `rf logo` (`si:<slug>`). If not found, follow the fallback in [../../video-core/references/assets.md](../../video-core/references/assets.md). Never invent one.
- `number` → `rolling-number` (with `locale` from the language).
- `claim` → `stamp` or `typed-title`.
- `concept` → `custom-animation`.

## Footage

- One shot per kept segment from `analysis/trims.json`, placed back to back on the timeline. These are the cuts.
- Set each scene's `facePos` from the face track. **Never zoom into the face**: no tighter crop, and no punch-ins unless ticked.

## Captions

The ticked style, with groups of 1–4 words. In `split` and `full-graphics` scenes the panel is light (`#F7F3EA`), so
captions must stay readable there. The first test's white captions on beige were barely legible. Keep captions
over the face card in split scenes, or rely on the caption ink the compiler uses for panels.

## Before saving

1. `rf validate plan.json`, and fix every error.
2. `rf gaps plan.json` must be `[]`. Fix gaps by adding visuals, never by shortening the talk.
3. `rf save plan.json --request "first cut"`.
