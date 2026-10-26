# One look, never the same beat twice

Eren rejected the first talking-head and app drafts as "always repetitive: same animations, same sounds, same
logo, same visuals one after another" and "nothing really matching the app's actual design". Both failures have the
same cure: **one design kit for the whole video, and a new, specific graphic for every beat.**

## 1. Decide the kit first (write it to `analysis/kit.md`, then into `plan.look`)

The kit is the video's visual language. Every graphic, built-in card or scene script, is built from it.

| Token (`plan.look`) | Meaning | Talking head (onur.builds) | App video |
|---|---|---|---|
| `background` | panel ground | `#F2EEE6` warm cream | the app's own ground (from its theme file) |
| `card` | card surface | `#FFFFFF` | the app's surface colour |
| `ink` | main text | `#151515` | the app's ink |
| `muted` | labels, secondary | `#8A857A` | the app's secondary |
| `accent` | the one highlight | `#F5B700` yellow | the app's accent (prao: coral `#F0585B`) |
| `positive` / `negative` | checks / crosses, stamps | `#1F9D55` / `#E5322D` | the app's success / danger |
| `radius` | card corners (px) | `28` | the app's radius ×(video scale) |
| `font` | `Inter` or `Nunito` | `Inter` | closest of the two to the app's font |

These tokens are CSS variables on the page (`var(--card)`, `var(--accent)`, `var(--radius)` …) and in a scene
script as `kit.card`, `kit.accent` …. Built-in cards use them automatically. **In your own scenes use the variables,
never fresh hex values**, so the whole video stays one look.

Kit components (draw them the same way every time they appear): the card (surface, radius, soft shadow
`0 14px 40px rgba(0,0,0,.10)`), the icon chip (a 56 px rounded square holding a line icon), the small-caps label
(`muted`, 22 px, letter-spacing 2px, uppercase), the value (`ink`, 800 weight), the check (a `positive` circle with a
white tick), the stamp (outlined, rotated −6°, `negative` or `positive`).

## 2. Every beat is a different, specific graphic

Graphics **show what the words can't**: the number, the list, the comparison, the object, the rule, the result.
Captions already carry the words, so a card that just repeats the sentence is refused by `rf validate`.

Walk the transcript sentence by sentence and ask "what would I draw on a whiteboard here?":

| The speaker… | Draw (onur.builds / msevimli_ did exactly this) |
|---|---|
| names an amount | a labelled value card counting up (`count()`), then a second card that derives from it (spend 1.000.000 ₺ → "devlet geri öder" 700.000 ₺ + "%70 GERİ" stamp) |
| lists things | rows that slide in one per spoken item, each with its icon, then each row gets its check on its word; the list stays and grows |
| compares | two bars with a dashed empty state that fill to %50 / %70; or two cards side by side with ✓ and ✗ |
| states a rule that changed | the rule card, then a stamp ("KALKTI"), then a before → after flow (BUGÜN Şirketi kur → YARIN Başvur) |
| names places / brands | a row of their flags / logos dropping in one by one (each logo **once** per video) |
| corrects a number | the old value struck through, an arrow, the new value in `negative` ("%70 → %50") |
| explains a process | an illustrated metaphor (a stick figure at a desk, files flying onto it), or a mock app window where the command gets typed and progress rows fill |
| describes a schedule / automation | a task card with a time ("03:00"), a toggle switching on, a counter of done jobs |
| says something personal | no graphic: go `full-face` |

Then make the sequence varied:

- **No template twice in a row, and each built-in template at most twice per video** (`rf validate` refuses more). Most beats should be your own `custom-animation` scenes.
- **Graphics accumulate and transform** instead of popping in and out: a scene keeps its cards while new rows join, a value card changes its number, a stamp lands on a card that's already there. One scene card can carry 4–10 s of talk with several beats; list them in its `beats` so `rf gaps` sees the motion.
- **Vary the entrance by meaning**: rows slide in from the side with a small tilt and settle; numbers count or roll; stamps slam (scale 1.6 → 1, rotate); illustrations draw their strokes (`stroke-dashoffset`); app windows rise; flags drop with a bounce. Never the same fade-up for everything.
- **Vary the sound with the gesture** ([sfx.md](sfx.md)); never the same file twice in a row.
- **Layouts breathe**: split (graphics top, wide face card bottom) → graphics only for a concept → full face for the personal line → split again. The face card is a wide 4:3 window of the whole frame, not a strip and not a zoom.

## 3. Size and fill

Eren watches on a phone. The second talking-head draft had a lone 500 px label card and a small logo floating in an
empty cream half: that reads as unfinished.

- **Fill the region.** A split panel (1080×960) holds 2–4 elements that together span its width (cards ~900 px wide, 90 px side margins) and most of its height by the end of the scene. A `full-graphics` scene fills the frame like a poster.
- **Big type:** values 72–110 px, row text 40–48 px, headlines 64–90 px, small-caps labels 22–26 px. Nothing else under 32 px.
- **Objects, not dots:** draw the thing (a gauge with its arc and ticks, a phone with its screen, a classroom with desks and a hand raised), with enough detail to read at a glance.
- Keep the caption band (y 1280–1480 on 9:16) clear in `full-graphics` scenes.

## 4. Look before you save: `rf preview`

`rf preview plan.json --at <t1,t2,…>` renders stills of your plan (about 25 s) into `analysis/preview/` with a
`contact-sheet.jpg`. **Always** preview the settled middle of every scene (and the end of each building scene) and
read the sheet. Fix anything empty, small, overlapping, cut off, unreadable, or that looks like the previous scene,
then preview again. Do this before `rf save`.

## 5. Watching references

When the user gives reference reels, **watch them densely** before planning: `rf sheet <ref> analysis/ref-<n>.jpg --every 0.5`
in 10 s chunks (`rf prep` a chunk first if needed), and write `analysis/references.md` listing, per reference: the kit
(colours, card style, type, caption style), every distinct graphic idea with its time, how elements enter and leave,
how the face is framed, and what you'll borrow. Plan from that list, not from memory.
