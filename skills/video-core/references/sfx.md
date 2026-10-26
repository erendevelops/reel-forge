# Sound effects

248 bundled CC0 sounds. A plan references them as `sfx/<family>/<file>` (e.g. `sfx/impact/impactSoft_medium_001.ogg`);
the app resolves them, nothing to copy. **Sound only what is visibly happening, and match the sound to the gesture**:
a typed digit sounds like a key, a card sliding sounds like a card, a chip landing sounds like a chip. No whooshes.

`rf validate` enforces variety (talking-head and app videos): the same file never plays twice in a row and at most
twice per video (keypresses excepted). Every family below has several files: rotate through them.

## By action

| Action on screen | Files | Volume |
|---|---|---|
| Typing, per character / digit | `keyboard/keypress-001.wav` … `keypress-032.wav`, a different one per key (thin out to every 2nd key on long strings) | 0.35–0.5 |
| Tap / press / select | `interface/click_002.ogg`, `click_003.ogg`, `click_005.ogg`, `ui/click2.ogg`, `ui/mouseclick1.ogg`, `interface/select_008.ogg` | 0.5–0.6 |
| Toggle / switch on | `interface/switch_002.ogg`, `switch_005.ogg`, `switch_006.ogg`, `switch_007.ogg`, `ui/switch11.ogg` | 0.5 |
| Card / panel slides in | `casino/card-slide-1.ogg` … `card-slide-8.ogg` | 0.35–0.45 |
| Card / tile / row lands | `casino/card-place-1.ogg` … `card-place-4.ogg`, `interface/drop_001.ogg` … `drop_003.ogg`, `drop_001.wav` … `drop_004.wav` | 0.4–0.5 |
| Several items fan out / cascade | `casino/card-fan-1.ogg`, `card-fan-2.ogg` (one cue for the whole cascade) | 0.4 |
| Check / tick / small confirm | `ui/rollover2.ogg`, `interface/click_003.ogg`, `pluck_002.wav`, `impact/impactGlass_light_001.ogg` … `_003.ogg` | 0.35–0.45 |
| Number lands / metric confirmed | `casino/chip-lay-1.ogg` … `chip-lay-3.ogg` | 0.45 |
| Counter running up | `casino/chips-stack-1.ogg` … `chips-stack-6.ogg` (start of the count) | 0.4 |
| Money / success with weight | `casino/chips-collide-1.ogg` … `chips-collide-4.ogg` | 0.45 |
| Stamp / slam | `impact/impactPunch_medium_000.ogg` … `_004.ogg`, `impact/impactPlate_medium_000.ogg` … `_004.ogg` | 0.45–0.55 |
| Big reveal / hard layout change | `impact/impactSoft_medium_000.ogg` … `_004.ogg` (the safest family) | 0.5 |
| Logo / payoff / hero moment | `impact/impactBell_heavy_000.ogg`, `_003.ogg`, `_004.ogg`, `interface/bong_001.ogg`, `maximize_006.wav` | 0.45–0.5 |
| Warm organic tap (illustration, paper, desk) | `impact/impactWood_light_000.ogg` … `_004.ogg`, `impact/footstep_wood_000.ogg` | 0.4 |
| Wrong / error / crossed out | `interface/error_005.ogg`, `error_006.ogg` | 0.4 |
| Glitch / AI / tech moment | `interface/glitch_002.ogg`, `glitch_004.ogg` (tiny accents only) | 0.35 |
| Pack / box opens, reveal of many | `casino/cards-pack-open-1.ogg`, `cards-pack-open-2.ogg` | 0.4 |

`casino/` and `ui/` files are bright: keep them short, quiet and isolated. `impact/` is warm and safe for repeats.
`assets/sfx/sfx-analysis.json` (repo) has per-file brightness if you need to choose finely.

## Rules

- Fire the sound at the **start** of a press/slide and at the **landing** of a drop/stamp/reveal.
- One sonic palette per video: pick 4–6 families that fit the look (a paper/illustration video leans wood and soft impacts; a fintech UI leans chips and clicks) and stay within them.
- Density follows the picture: a typing run is many soft keys; a reveal is one sound. Never two cues within 0.08 s unless one is a keypress.
- Nothing louder than the voice or the music's peaks.
