# Sound effects

About 290 bundled CC0 sounds. A plan references them by their **full path** `sfx/<family>/<file>` (e.g.
`sfx/impact/impactSoft_medium_001.ogg`; `sfx/casino/card-slide-3.ogg`, never `sfx/card-slide-3.ogg`). Ranges like
`card-slide-1.ogg … card-slide-8.ogg` mean every file in between, in the same folder. The app resolves them, nothing to
copy; `rf validate` names any path that doesn't exist. **Sound only what is visibly happening, and match the sound to the gesture**:
a typed digit sounds like a key, a card sliding sounds like a card, a chip landing sounds like a chip. No whooshes.

`rf validate` enforces variety (talking-head and app videos): the same file never plays twice in a row and at most
twice per video (keypresses excepted). Every family below has several files: rotate through them.

## By action

| Action on screen | Files | Volume |
|---|---|---|
| Typing, per character / digit | `sfx/keyboard/keypress-001.wav` … `keypress-032.wav`, a different one per key (thin out to every 2nd key on long strings) | 0.35–0.5 |
| Tap / press / select | `sfx/interface/click_002.ogg`, `click_003.ogg`, `click_005.ogg`, `sfx/ui/click2.ogg`, `sfx/ui/mouseclick1.ogg`, `sfx/interface/select_008.ogg` | 0.5–0.6 |
| Toggle / switch on | `sfx/interface/switch_002.ogg`, `switch_005.ogg`, `switch_006.ogg`, `switch_007.ogg`, `sfx/ui/switch11.ogg` | 0.5 |
| Card / panel slides in | `sfx/casino/card-slide-1.ogg` … `card-slide-8.ogg` | 0.35–0.45 |
| Card / tile / row lands | `sfx/casino/card-place-1.ogg` … `card-place-4.ogg`, `sfx/interface/drop_001.ogg` … `drop_003.ogg`, `sfx/drop_001.wav` … `sfx/drop_004.wav` | 0.4–0.5 |
| Several items fan out / cascade | `sfx/casino/card-fan-1.ogg`, `card-fan-2.ogg` (one cue for the whole cascade) | 0.4 |
| Check / tick / small confirm | `sfx/ui/rollover2.ogg`, `sfx/interface/click_003.ogg`, `sfx/pluck_002.wav`, `sfx/impact/impactGlass_light_001.ogg` … `_003.ogg` | 0.35–0.45 |
| Number lands / metric confirmed | `sfx/casino/chip-lay-1.ogg` … `chip-lay-3.ogg` | 0.45 |
| Counter running up | `sfx/casino/chips-stack-1.ogg` … `chips-stack-6.ogg` (start of the count) | 0.4 |
| Money / success with weight | `sfx/casino/chips-collide-1.ogg` … `chips-collide-4.ogg` | 0.45 |
| Stamp / slam | `sfx/impact/impactPunch_medium_000.ogg` … `_004.ogg`, `sfx/impact/impactPlate_medium_000.ogg` … `_004.ogg` | 0.45–0.55 |
| Big reveal / hard layout change | `sfx/impact/impactSoft_medium_000.ogg` … `_004.ogg` (the safest family) | 0.5 |
| Logo / payoff / hero moment | `sfx/impact/impactBell_heavy_000.ogg`, `_003.ogg`, `_004.ogg`, `sfx/interface/bong_001.ogg`, `sfx/maximize_006.wav` | 0.45–0.5 |
| Warm organic tap (illustration, paper, desk) | `sfx/impact/impactWood_light_000.ogg` … `_004.ogg`, `sfx/impact/footstep_wood_000.ogg` | 0.4 |
| Wrong / error / crossed out | `sfx/interface/error_005.ogg`, `error_006.ogg` | 0.4 |
| Glitch / AI / tech moment | `sfx/interface/glitch_002.ogg`, `glitch_004.ogg` (tiny accents only) | 0.35 |
| Pack / box opens, reveal of many | `sfx/casino/cards-pack-open-1.ogg`, `cards-pack-open-2.ogg` | 0.4 |
| Something appears / pops in (a shape, a toast, a chip) | `sfx/kit/pop.ogg`, `sfx/pop/fs-824189-pop-in-sfx.ogg`, `fs-447910-plop.ogg`, `fs527522.ogg`, `fs323738.ogg`, `fs202230.ogg` | 0.35–0.45 |
| Cursor click on a pill / button (motion scenes) | `sfx/kit/click.ogg`, `sfx/click/fs788933.ogg`, `sfx/pop/fs-467951-ui-button-click.ogg` | 0.45–0.55 |
| Hover / tiny UI change, a highlight moving | `sfx/kit/tick.ogg`, `sfx/tick/fs528561.ogg`, `fs384187.ogg`, `fs721514.ogg` (very quiet) | 0.2–0.3 |
| Success / done / notification | `sfx/ding/fs-571513-soft-notifications-bell-ding-d.ogg`, `fs-634690-lil-pip.ogg`, `fs-349504-triangle-open-04.ogg` | 0.35–0.45 |
| Build-up into a reveal | `sfx/kit/riser.ogg`, `sfx/riser/fs867126.ogg`, `fs-685256-riser-sound-effect-short-wav.ogg` — it must **end** on the hit (start = hit − its length) | 0.3–0.4 |
| The one big reveal of the video | `sfx/kit/impact.ogg`, `sfx/impact/fs524817.ogg`, `fs745291.ogg`; trailer scale only for `cinematic`: `fs-177242-cinematic-impact.ogg`, `fs-222517-dramatic-hit.ogg` | 0.45–0.55 |
| A long typing run (instead of one key per character) | `sfx/typing/fs-447909-keyboard-typing.ogg`, `fs-323432-typing.ogg` (one cue at the start, quiet), `fs-416777-digital-typing-wav.ogg` for a digital readout | 0.25–0.35 |
| Error / tech / rewind | `sfx/glitch/fs-144546-touchs-wav.ogg`, `fs-402451-fast-forward.ogg` (short accents) | 0.3 |

`sfx/casino/` and `sfx/ui/` files are bright: keep them short, quiet and isolated. `sfx/impact/` is warm and safe for repeats.
`assets/sfx/sfx-analysis.json` (repo) has per-file brightness if you need to choose finely.

## Rules

- Fire the sound at the **start** of a press/slide and at the **landing** of a drop/stamp/reveal.
- One sonic palette per video: pick 4–6 families that fit the look (a paper/illustration video leans wood and soft impacts; a fintech UI leans chips and clicks) and stay within them.
- Density follows the picture: a typing run is many soft keys; a reveal is one sound. Never two cues within 0.08 s unless one is a keypress.
- Nothing louder than the voice or the music's peaks. Priority: voice > sound effects > music.
- Motion scenes: a sound per state change, not per frame: the click on the press, a pop when the shape lands in its new state, a tick when a highlight moves, a ding on the confirmation. A morph that lands on a word gets its sound on that word.
- Long files (4–6 s risers, impacts with tails) are fine: they are cut by the next scene; keep the volume low.
