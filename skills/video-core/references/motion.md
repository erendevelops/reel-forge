# Motion language

How a scene should *move*. Adapted from Bart's motion-graphics skills
([Barty-Bart/motion-graphics](https://github.com/Barty-Bart/motion-graphics), MIT). Read it before writing any
`custom-animation` scene; the `mo` helpers below make it the easy path.

## The idea: one shape that never cuts

A scene is not a slideshow of cards. It is **one element that keeps transforming**: a pill grows into a card, the
card shrinks into a confirmation, a dot becomes the next background. Content inside it swaps with a short blur. A
cursor drives the changes with real clicks and drags, the camera pushes in so each state fills the frame, and
**every change lands on a spoken word** (or a beat in a music-led video).

- **Springs, not tweens.** Size, position and scale ride damped springs: fast, a tiny overshoot at most, settled.
  The leading edge of a moving highlight rides a faster spring than the trailing edge, so it stretches.
- **Swap content, keep the container.** Old content leaves fast into a blur; new content waits a beat, then
  sharpens in. Never cross-fade two texts on top of each other.
- **The camera is the editor.** Push in on the state that matters (it fills ~60–75 % of the frame), ease out to show
  where you are, glide to the next. Critically damped, never bouncy.
- **Show the real objects.** The folder, the terminal, the file, the product, the result, pulled from the words.
  Use the product's real labels. Numbers, prices and quotes only when they were said or given; otherwise relative
  bars, progress and skeleton lines.
- **Pace to speech.** One change per spoken beat, about 0.4–1.2 s apart. A state holds at least ~0.6 s settled
  before the next change so it can be read.
- **One idea per scene.** A long stretch on one idea can be one scene with several states.

**Banned:** bouncy easing, particles, glows, gradients on UI chrome, mixed icon strokes, emoji as icons, dead time
(a scene where nothing changes for 2 s+), anything that looks like a template, invented data.

## The `mo` kit (in every scene script)

All times are card-relative seconds, like `tl`. Everything is written into the seekable timeline.

| Call | What it does |
|---|---|
| `mo.spring(target, vars, at, name?)` | `tl.to` on a spring: `'morph'` (default), `'fast'`, `'slow'`, `'soft'`, `'cam'` (no overshoot), `'pop'`, `'snap'` |
| `mo.shape(target, states, start, [[at, state], …], { x, y, spring }?)` | **One shape that never cuts.** `states = { pill: { w, h, r, bg }, card: {…} }`; the element is centred on `(x, y)` (default the stage centre) and springs its size and corners to each state; colour eases without overshoot |
| `mo.swap(out, in, at)` / `mo.show(target, at)` / `mo.hide(target, at)` | Content swap: out blurs away in 0.12 s, in waits 0.07 s and sharpens in over 0.26 s. Give layers `visibility: hidden` in CSS until shown |
| `mo.pop(target, at)` | Pops in from 55 % with a slight overshoot (first appearance of the shape) |
| `mo.press(target, at)` | A button dips and springs back. Pair it with a cursor click at the same `at` |
| `mo.cursor([[at, x, y], …], { clicks, drags, parent, out, size, color })` | A real arrow cursor moving on gently arced, eased paths. `clicks: [at…]` dip it; `drags: [[from, to]…]` hold it down; `parent: '#world'` makes it ride the camera; `out` fades it |
| `mo.camera(world, [[at, scale, fx, fy], …])` | Puts stage point `(fx, fy)` in the centre at that zoom, on a critically damped spring. `world` wraps everything (shape, cursor, extras) |
| `mo.indicator(target, [[at, left, width], …])` | A liquid highlight between tabs / levels / rows: leading edge fast, trailing edge slow |
| `mo.icon(name, size, colour, stroke?)` | SVG markup from one stroke icon set (`mo.icons` lists the names: arrow, check, x, plus, folder, terminal, file, pencil, coin, clock, chip, sparkle, search, play, send, image, video, mic, user, heart, bolt, chart, lock, bell, settings) |
| `mo.ease(name)`, `mo.settle(name)` | The spring as a GSAP ease and its settle time, for your own `tl.to` |

`type()` and `count()` still do typing and counting; `rand()` scatter; `kit` the colours.

## Interaction vocabulary

Map what is said onto one of these (they are what makes it look like a real product moving):

| The line says… | Show | `mo` recipe |
|---|---|---|
| an action ("I click", "you ask it") | a primary button (pill) | `mo.cursor` to it, `mo.press` + click on the word, then `mo.shape` grows it into the result |
| something is working | progress: a loader, bars, lanes filling | bars with `mo.spring(bar, { width })` on the words; a status island that morphs |
| it's done / it worked | confirmation: a check, a toast | the shape shrinks into a pill with `mo.icon('check')`, `mo.pop` a toast |
| live status | an island that changes text | `mo.shape` small pill states + `mo.swap` the label |
| details | a card with a drag | `mo.cursor` with `drags`, the card follows (`mo.spring` its `x`/`y` to the drop point) |
| more / less, a setting | a slider or toggle | the knob follows the cursor (`mo.spring` its `x`), the fill and the value with it |
| options | tabs | `mo.indicator` under the active tab, `mo.swap` the content |
| a trend, a comparison of numbers | a chart with a tooltip | bars `mo.spring` their height, a tooltip `mo.pop`s on the word |
| finding something | search and a filtering list | `type()` in the field, rows `mo.hide` as they filter out, the rest slide up |
| a file / input goes somewhere | file → drag → drop target | `mo.cursor` drag, the target highlights, `mo.swap` into the result |
| code, a command | terminal typing | `type()` line by line, output rows `mo.show` |
| before vs after | side by side | two shapes, one dims (`opacity`) as the other wins |
| a new section | chapter card | the shape becomes a big pill with the chapter word, then grows into the next scene |

## Example: a button that becomes the result

```fragment-json
{
  "html": "<div id=\"world\"><div id=\"sh\"><div id=\"l1\" class=\"L\"><span id=\"ic\"></span><b>Claude ile oluştur</b></div><div id=\"l2\" class=\"L col\"><div id=\"prompt\" class=\"p\"></div><div class=\"r r0\"></div><div class=\"r r1\"></div><div class=\"r r2\"></div></div><div id=\"l3\" class=\"L\"><span id=\"ok\"></span><b class=\"dk\">Hazır</b></div></div></div>",
  "css": ".L { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 18px; color: #FFFFFF; font: 700 40px Inter; white-space: nowrap; } .col { flex-direction: column; align-items: stretch; justify-content: flex-start; padding: 48px; gap: 26px; } .p { height: 90px; border-radius: 22px; background: #F1EFEA; padding: 22px 26px; font: 600 38px Inter; color: var(--ink); } .r { height: 64px; border-radius: 18px; background: #ECE9E3; visibility: hidden; } .dk { color: #111111; } #l2, #l3 { visibility: hidden; }",
  "script": "const world = $('#world');\nmo.camera(world, [[0, 1.5, W / 2, H / 2], [1.6, 1.15, W / 2, H / 2], [4.0, 1.4, W / 2, H / 2]]);\nmo.shape('#sh', { pill: { w: 520, h: 110, r: 55, bg: '#0B0B0B' }, card: { w: 760, h: 560, r: 36, bg: '#FFFFFF' }, done: { w: 440, h: 130, r: 65, bg: kit.accent } }, 'pill', [[1.6, 'card'], [4.0, 'done']]);\nmo.pop('#sh', 0.1);\n$('#ic').innerHTML = mo.icon('sparkle', 44, '#FFFFFF');\nmo.show('#l1', 0.15);\nmo.cursor([[0.4, W / 2 + 260, H / 2 + 260], [1.3, W / 2 + 150, H / 2 + 20]], { clicks: [1.45], parent: '#world', out: 1.9 });\nmo.press('#sh', 1.45);\nmo.swap('#l1', '#l2', 1.6);\ntype('#prompt', 'Reels için kapak tasarla', 2.0, 22);\nfor (let i = 0; i < 3; i++) mo.show('.r' + i, 2.6 + i * 0.25);\nmo.swap('#l2', '#l3', 4.0);\n$('#ok').innerHTML = mo.icon('check', 52, '#111111');",
  "beats": [0.1, 1.45, 1.6, 2.0, 2.6, 4.0]
}
```

The cursor clicks the pill on "oluştur" (1.45), the pill grows into a card while the camera pulls back (1.6), the
prompt types, three result rows land, and the card shrinks into a "Hazır" pill as the camera pushes in (4.0).

## How much of the frame (talking heads)

Decide per line and say why ([../../reel-talking-head/references/plan.md](../../reel-talking-head/references/plan.md)):

- **Full-frame cutaway** (`full-graphics`): the line describes something to *see* (a product, a process, a
  comparison, a number, a chapter change). Hold it for the length of the idea (3–10 s), then give the face back.
  Never in the first second of the hook, never on a personal, emotional or opinion line; at least ~2 s of face
  between cutaways.
- **Panel** (`split`): the face stays; the graphic lives in the empty half and can run long (15 s+) as one morph.
- **Nothing** (`full-face`): the line is about the speaker, or it is too close to another graphic.

## Check

`rf preview plan.json --at <each state settled, plus one mid-morph per scene>` and look at every frame: nothing
cramped, clipped, unreadable or off its word, the cursor never leaves the frame at any zoom, no two states overlap.
