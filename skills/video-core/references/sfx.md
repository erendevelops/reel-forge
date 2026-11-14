# Sound effects

About 40 bundled CC0 sounds, picked for a clean, modern product feel (the old game-style packs were removed). A plan
references them by their **full path** `sfx/<family>/<file>` (e.g. `sfx/kit/pop.ogg`, `sfx/pop/fs527522.ogg`). The
app resolves them, nothing to copy; `rf validate` names any path that doesn't exist. **Sound only what is visibly
happening, and match the sound to the gesture.** No whooshes.

`rf validate` enforces variety: the same file never plays within three cues of itself and at most twice per video.
Every family has several files: rotate through them, and lead with the families the prompt gives this project.

## By action

| Action on screen | Files | Volume |
|---|---|---|
| Something appears / pops in (a shape, a card, a row, a toast, a logo) | `sfx/kit/pop.ogg`, `sfx/pop/fs-824189-pop-in-sfx.ogg`, `fs-447910-plop.ogg`, `fs527522.ogg`, `fs323738.ogg`, `fs202230.ogg`, `fs-258269-mouth-pop.ogg` | 0.35–0.45 |
| Tap / press / cursor click / select | `sfx/kit/click.ogg`, `sfx/click/fs788933.ogg`, `sfx/pop/fs-467951-ui-button-click.ogg`, `sfx/pop/fs-514833-user-interface-menu-sounds-wav.ogg` | 0.45–0.55 |
| Hover, a highlight moving, a check ticked, a list row landing | `sfx/kit/tick.ogg`, `sfx/tick/fs528561.ogg`, `fs384187.ogg`, `fs721514.ogg` (quiet) | 0.2–0.35 |
| Success / done / notification / payoff | `sfx/ding/fs-571513-soft-notifications-bell-ding-d.ogg`, `fs-634690-lil-pip.ogg`, `fs-349504-triangle-open-04.ogg` | 0.35–0.45 |
| Build-up into a reveal | `sfx/kit/riser.ogg`, `sfx/riser/fs867126.ogg`, `fs-685256-riser-sound-effect-short-wav.ogg`, `fs-464250-echo-chromatic-riser-wav.ogg` — it must **end** on the hit (start = hit − its length) | 0.3–0.4 |
| Stamp / slam / the one big reveal | `sfx/kit/impact.ogg`, `sfx/impact/fs524817.ogg`, `fs745291.ogg`; trailer scale only for `cinematic`: `fs-177242-cinematic-impact.ogg`, `fs-222517-dramatic-hit.ogg`, `fs-347561-micheal-bay-hit.ogg` | 0.45–0.55 |
| Typing (a title, a prompt, a number readout) | one quiet cue at the start: `sfx/typing/fs-447909-keyboard-typing.ogg`, `fs-323432-typing.ogg`, `fs-79388-keyboard-typing-wav.ogg`; a digital readout `fs-416777-digital-typing-wav.ogg`, data appearing `fs-511418-data-reveal-sound.ogg` | 0.25–0.35 |
| Counter running up | `sfx/typing/fs-416777-digital-typing-wav.ogg` at the start, a `ding` or `pop` when it lands | 0.3 |
| Error / tech / rewind / crossed out | `sfx/glitch/fs-144546-touchs-wav.ogg`, `fs-402451-fast-forward.ogg`, `fs-339521-vhs-rewind-forward-and-eject.ogg`, `sfx/riser/fs-174363-rewind.ogg` (short accents) | 0.3 |
| Tension (cinematic only) | `sfx/riser/fs-396161-scary-hits-risers-001.ogg`, `fs-396160-scary-hits-risers-002.ogg` | 0.3 |

## Rules

- Fire the sound at the **start** of a press/slide and at the **landing** of a drop/stamp/reveal.
- One sonic palette per video: lead with the 3–4 families the prompt names for this project and stay mostly within them, so each video sounds like itself. Not every graphic needs a sound: a quiet beat makes the next sound land.
- Density follows the picture: a typing run is one quiet typing cue; a reveal is one sound. Never two cues within 0.08 s.
- Nothing louder than the voice or the music's peaks. Priority: voice > sound effects > music.
- Motion scenes: a sound per state change, not per frame: the click on the press, a pop when the shape lands in its new state, a tick when a highlight moves, a ding on the confirmation. A morph that lands on a word gets its sound on that word.
- Long files (4–6 s risers, impacts with tails) are fine: they are cut by the next scene; keep the volume low.
