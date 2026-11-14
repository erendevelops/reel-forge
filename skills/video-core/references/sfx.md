# Sound effects

About 30 bundled CC0 sounds, picked for a clean, modern product feel (the old game-style packs were removed). A plan
references them by their **full path** `sfx/<family>/<file>` (e.g. `sfx/kit/pop.ogg`, `sfx/pop/fs527522.ogg`). The
app resolves them, nothing to copy; `rf validate` names any path that doesn't exist. **Sound only what is visibly
happening, and match the sound to the gesture.** No whooshes.

**Less, calmer, consistent.** Sound effects support the picture; they are never the show. A video uses a **small
palette of 3–5 files** chosen once, and the same gesture always gets the same sound (every row landing is the same
soft tick, every press the same click): that is what makes it feel designed rather than random. `rf validate`
refuses more than 5 different files in one video. Most graphics need no sound at all.

## By action

| Action on screen | Files | Volume |
|---|---|---|
| Something appears / pops in (a shape, a card, a row, a toast, a logo) | `sfx/kit/pop.ogg`, `sfx/pop/fs-824189-pop-in-sfx.ogg`, `fs-447910-plop.ogg`, `fs527522.ogg`, `fs323738.ogg`, `fs202230.ogg` | 0.3–0.4 |
| Tap / press / cursor click / select | `sfx/kit/click.ogg`, `sfx/click/fs788933.ogg`, `sfx/pop/fs-467951-ui-button-click.ogg`, `sfx/pop/fs-514833-user-interface-menu-sounds-wav.ogg` | 0.45–0.55 |
| Hover, a highlight moving, a check ticked, a list row landing | `sfx/kit/tick.ogg`, `sfx/tick/fs528561.ogg`, `fs384187.ogg`, `fs721514.ogg` (quiet) | 0.2–0.35 |
| Success / done / notification / payoff | `sfx/ding/fs-571513-soft-notifications-bell-ding-d.ogg`, `fs-634690-lil-pip.ogg`, `fs-349504-triangle-open-04.ogg` | 0.35–0.45 |
| Build-up into a reveal | `sfx/kit/riser.ogg`, `sfx/riser/fs867126.ogg`, `fs-685256-riser-sound-effect-short-wav.ogg`, `fs-464250-echo-chromatic-riser-wav.ogg` — it must **end** on the hit (start = hit − its length) | 0.3–0.4 |
| Stamp / slam / the one big reveal | `sfx/kit/impact.ogg`, `sfx/impact/fs524817.ogg`, `fs745291.ogg` (soft, never trailer-style) | 0.35–0.45 |
| Typing (a title, a prompt, a number readout) | one quiet cue at the start: `sfx/typing/fs-447909-keyboard-typing.ogg`, `fs-323432-typing.ogg`, `fs-79388-keyboard-typing-wav.ogg`; a digital readout `fs-416777-digital-typing-wav.ogg`, data appearing `fs-511418-data-reveal-sound.ogg` | 0.25–0.35 |
| Counter running up | `sfx/typing/fs-416777-digital-typing-wav.ogg` at the start, a `ding` or `pop` when it lands | 0.3 |

## Rules

- **Pick the palette first**: one pop, one click, one tick, at most one ding and one riser/impact pair. Reuse them
  for the same gesture all through the video. Never rotate through files just to be different.
- **Sparse**: sound the moments that matter (a press, a card landing, the payoff), not every motion. Roughly one cue
  every 3–4 s on average; a stretch of speech with no sound is fine.
- **Quiet**: 0.25–0.45; nothing near the voice's level. Priority: voice > music > sound effects.
- **Never cartoonish**: no mouth pops, boings, swooshes, glitches, trailer hits or horror risers. If a sound would
  make the viewer smile at the sound itself, leave it out.
- Fire the sound at the **start** of a press and at the **landing** of a drop/stamp/reveal. Never two cues within
  0.15 s.
- A riser must **end** on its hit (start = hit − its length); at most one riser per video.
- When the user turns sounds down or off for part of the video, that holds for the next versions too.
