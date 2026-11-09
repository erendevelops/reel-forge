# Styles

A style is the **structure** of the film; a tone ([tones.md](tones.md)) is its energy and type. Pick one style in
`product.json.rubric.style` from the brief (the user's direction, the reference reels, the product), say which and
why in the storyboard. Default: `showcase`. Adapted from Bart's explainer skills
([Barty-Bart/motion-graphics](https://github.com/Barty-Bart/motion-graphics), MIT), rebuilt on Reelforge scenes: every
scene is a `custom-animation` with the `mo` kit ([../../video-core/references/motion.md](../../video-core/references/motion.md)),
music comes from the picked track (never synthesised), and transitions get pops and impacts, never whooshes.

Rules for every style: **never invent facts** (customer counts, ratings, revenue, testimonials, "free"); numbers only
from `product.json`, otherwise relative bars, progress and skeleton lines. Example content inside the UI (a prompt, a
file name, a receipt) is fine and should be believable. Logos only the product's own or ones the user supplied;
third-party integrations as neutral rounded tiles with the name.

## `showcase` (default, 15–25 s)

The storyboard shape in [plan.md](plan.md): hook → reveal → 2–3 product moments → punchline → outro.

## `demo` (calm product demo, 30–60 s)

A premium homepage demo. Restraint: a bright, airy canvas, one short line at a time, the product's UI rebuilt and
filmed **up close** while it is used. Pick it when the user wants a walkthrough or "how it works".

1. **Open (≈3 s):** a small word ("Introducing" / "Tanıtıyoruz") on the plain canvas, dissolving into the name on a
   soft brand gradient.
2. **The ask (≈4 s):** a line the viewer recognises ("Hâlâ harcamaları elle mi yazıyorsun?") or straight into the
   product's input: a big rounded field with a placeholder and suggestion chips.
3. **Feature chapters (2–4, 8–12 s each):**
   - a **title line**, small, centred; the camera (`mo.camera`) pushes in until it spans ~75 % of the width, and one
     key word gets a soft accent box sweeping left to right behind it (`scaleX` 0 → 1, `transformOrigin: 'left'`);
   - the **UI moment**: the real component, cropped to what matters and shown big; the camera rides the action
     (typing follows the caret, steps tick spinner → check, results stack, a table fills row by row, the cursor
     clicks a cell and the value reveals);
   - the **pull-back**: the camera eases out to show the whole screen for a beat, then glides on.
4. **Closer + end card (≈5 s):** the tagline with its key phrase highlighted, then the name and the URL / call to
   action the user gave (none → name and tagline).

Premium rules: one line of text **or** one UI element on screen, rarely both; no hard cuts (camera moves or a short
blur-dissolve); camera moves critically damped (`'cam'`), nothing bounces; title lines become big through the
camera, not the font size; typing at ~25 characters per second with a 0.5 s pause after each result; one accent
colour; no busy backgrounds, emoji, big shadows or glassmorphism. Default palette if the brand gives none: canvas
`#F7F7F8`, ink `#111114`, muted `#8A8A94`, white surfaces with `#E7E7EC` borders, accent `#2E6BFF`.

## `hype` (high-energy promo, 12–20 s)

A showreel on a 120–140 BPM grid: something lands every half-second, but **a shape carries the eye across every
transition**, so it never feels like random cuts. Needs a picked music track; align with `rf beats`.

Scenes (6–8 of 1.5–3 s, one idea each; 6 strong beat 8 weak):

1. **Spark open:** near-black canvas with a faint grid; a tiny accent mark pulses, stretches into a thin line with a
   small mono label (`product / launch — 2026`), then floods the screen vertically: the flood is the next background.
2. **Brand slam:** the name in a heavy grotesk, huge, letters revealed by masks on consecutive 1/16 beats, a mono
   kicker above, an italic serif line below (what it is, 2–4 words). Its full stop detaches and grows into the next
   scene's shape.
3. **Kinetic triplet:** the value in three short words, two beats each, each with its own background and treatment
   (dark on cream; accent on black with the word repeated as an outline pattern; white on blue inside viewfinder
   brackets), entering with a fast blur-slide and a slight overshoot (`'pop'`).
4. **Signature visual:** one "how did they make that" moment that symbolises the product (a grid of tiles rippling
   from the centre for building blocks, dots condensing into a ring for data/AI, a blob morphing for flexibility).
5. **Product micro-moment:** one real interaction as a floating card tilted slightly in 3D with two ghost cards
   behind it: the cursor flicks a toggle, presses the main button, a progress bar fills, the button becomes
   "Done ✓", a toast slides in.
6. **Proof (only real numbers):** a big count-up, a ring, bars rising with one accent bar. No real numbers → skip.
7. **End card (2 s hold):** the name with the accent dot, the italic serif tagline, the URL typing in mono, a hairline.

Rules: transitions are objects (a flood, a growing bar, a dot that becomes the background, a word zooming through
the camera); a hard cut only on a downbeat, at most twice. Big changes on beats, type on 1/8–1/16 notes. A thin HUD
frame on every scene (corner brackets, `SCENE 02 / 07`, a tiny category label, a running timecode with a red dot,
~50 % opacity, mono). Type: heavy grotesk for slams, italic serif for the human line, mono for the HUD. At most 3
colours per scene besides black and white. Sound: an impact on each flood, pops on each typed word, a riser that
ends on the brand slam and the end card.

## `one-take` (one continuous shot, 10–30 s, loopable)

A single hero element (a ball, a cursor, a file tile, a message bubble) travels through the product's workflow,
laid out as **stations on one big world**; the camera follows it, each station reacts as it passes, then the camera
pulls far out to show the whole journey, and dives back to the start. Pick it for a story-driven, loopable piece.

- **The whole video is one `full-graphics` scene with one `custom-animation` card.** A `world` element about 3× the
  frame holds every station at a fixed spot; `mo.camera(world, …)` follows; the hero moves with per-frame `tl.set`s
  computed in the script (hops and falls are parabolas between contact points, each contact on a beat).
- **Stations** are the workflow's steps as real compact UI that **visibly changes because of the hero**: a toggle it
  switches on, a slider it rolls along (the value counts with its position), notification cards it bounces down
  (each pops in as it is hit, with a few words that narrate), a keyboard it hops across (keys press, letters appear),
  a chat bubble whose reply types out, a deploy button that launches it (a toast with the live URL).
- **Impacts:** squash 1.25 × 0.8 for ~60 ms on contact, stretch up to 1.15 × 0.9 in flight, a small push-down of
  what was hit.
- **Camera:** tight during each interaction (the station ~half the frame width, the hero 50–70 px on 1080p), wider in
  flight so the next station is visible, a 0.5 s hold on the payoff, then the **reveal**: ease out to ~0.3× with a
  slight 3D tilt, hold ~1 s while the hero arcs across (scale it up so it stays the brightest thing), dive back to
  the first station as the hero lands there. Stations reset in reverse during the reveal so the loop closes.
- **Look:** dark canvas with a faint dot grid that moves with the camera (it makes the moves readable), system-like
  UI, the hero the brightest thing on screen. No cuts, no explaining text overlays (station labels are the only
  text), no station that doesn't react, no floaty physics.
- **Sound:** every contact is the instrument: a tick or a pop per impact, clicks per key, a ding on the payoff, a
  riser into the launch and a soft impact on the landing.
