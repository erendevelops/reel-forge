# Plan a talking-head reel

## 1. Beats before scenes (`analysis/beats.md`)

Go through `analysis/transcript-trimmed.json` (with `analysis/topics.json`) sentence by sentence. For each sentence write one line: the time, what
is said, **the treatment** and **what you will draw** using the table in [../../video-core/references/look.md](../../video-core/references/look.md)
§2 ("names an amount → a value card counting up, then …") and the interaction vocabulary in
[../../video-core/references/motion.md](../../video-core/references/motion.md):

| Time | Line | Treatment | What the shape does, on which words | Why |
|---|---|---|---|---|
| 4.2–9.8 | "I opened Claude and asked it…" | cutaway (full-graphics) | a pill "Claude" → clicked on "asked" → grows into a chat card, the prompt types | a process to *see* |
| 9.8–12.1 | "honestly I was sceptical" | nothing (full-face) | – | personal line |

**The treatment is the most important call; make it per line and say why** (motion.md, "How much of the frame"):
cutaway for things to see (3–10 s, then the face back, ≥2 s of face between cutaways, never in the hook's first
second or on personal lines), panel (`split`) when the graphic can run long beside the face, nothing for personal
lines. Density: about 4–7 graphics per minute; the user's preferences or direction can make it lighter or heavier.

Rules for the list:

- A drawing is an object with information: a value, rows, bars, flags, a rule, a window, a metaphor. Never the sentence as text.
- Consecutive beats differ in kind (count → list → stamp → metaphor → comparison …). If two sentences are about the same thing, the second **transforms** the first scene (adds rows, recounts, strikes through) instead of starting a new card of the same kind.
- Mark personal sentences ("I was nervous too") as `full-face`, no graphic.
- A product, tool or brand named → its real logo, **once** in the video (`rf logo`), usually inside a row or card rather than floating alone.
- Plan at least one `full-graphics` concept scene (an illustrated metaphor or an app window doing the work) for the central idea.

## 2. Kit (`analysis/kit.md` → `plan.look`)

Default to the onur.builds kit (cream `#F2EEE6`, white cards, ink `#151515`, muted `#8A857A`, yellow accent
`#F5B700`, positive `#1F9D55`, negative `#E5322D`, radius 28, Inter). If the user gave references, derive the kit from them
instead ([../../video-core/references/look.md](../../video-core/references/look.md) §3). Write the kit into `plan.look`
and use its variables in every scene.

## 3. Scenes

- One scene per beat group (usually 3–10 s). Layout per the beat list; switch layouts on sentence boundaries.
- Graphics are mostly `custom-animation` scene scripts ([../../video-core/references/assets.md](../../video-core/references/assets.md)) built with the `mo` kit: one shape that morphs through the line's states, a cursor that clicks on the spoken word, content swapped with a blur, the camera pushing in ([motion.md](../../video-core/references/motion.md)). A split scene's region is the top half (1080×960 on 9:16); `full-graphics` is the whole frame.
- A scene card lives for the whole scene and keeps building; put every visible beat time in `beats`.
- Built-in templates (`rolling-number`, `checklist`, `stamp`, `bar-chart`, `typed-title`, `logo-pop`) are fine for a single beat, but at most twice each (a `stamp` once per video) and never in two scenes in a row. `follow-outro` closes the video.
- Every time on screen sits on its word (±0.1 s of the word start in the trimmed transcript).

## 4. Footage

- The footage is the trimmed take. One shot per scene with `from` = `at` = the scene start and `to` = the scene end, in trimmed time.
  - `full-face` scenes: the working clip `work/take-<ratio>.mp4` (cropped to the ratio).
  - `split` scenes: the **uncropped** trimmed take `work/take-trimmed.mp4` with `"aspect": <its width/height>` (e.g. `1.7778` for 1280×720), so the face card shows the whole frame with the room around the speaker (onur.builds). A take that is already vertical gets a wide 4:3 window of it automatically.
- Set each scene's `facePos` from the face track (it pans the full-frame crop and frames the 4:3 face card). **Never zoom into the face.** No punch-ins unless ticked.

## 5. Sound

One sound per visible action, matched to the gesture ([../../video-core/references/sfx.md](../../video-core/references/sfx.md)):
one typing cue for typed text, pops for rows and cards, ticks for checks, a ding on the payoff, an impact for the one
stamp, a click for the follow button. Lead with the families the prompt names for this project and rotate files.

## 6. Before saving

1. `rf preview plan.json --at <the middle of every scene>` and read `analysis/preview/contact-sheet.jpg` ([look.md](../../video-core/references/look.md) §3–4). Fix and preview again until every frame looks finished.
2. `rf validate plan.json`: fix every error (variety errors name the repeat and what to do instead).
3. `rf gaps plan.json` must be `[]`. Fix gaps with real beats in the scene (another row, a recount, a stamp), never filler.
4. `rf save plan.json --request "first cut"`.
