# Plan a talking-head reel

## 1. Beats before scenes (`analysis/beats.md`)

Go through `analysis/transcript-trimmed.json` (with `analysis/topics.json`) sentence by sentence. For each sentence write one line: the time, what
is said, and **what you will draw** using the table in [../../video-core/references/look.md](../../video-core/references/look.md)
§2 ("names an amount → a value card counting up, then …"). Rules for the list:

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
- Graphics are mostly `custom-animation` scene scripts ([../../video-core/references/assets.md](../../video-core/references/assets.md)). A split scene's region is the top half (1080×960 on 9:16); `full-graphics` is the whole frame.
- A scene card lives for the whole scene and keeps building; put every visible beat time in `beats`.
- Built-in templates (`rolling-number`, `checklist`, `stamp`, `bar-chart`, `typed-title`, `logo-pop`) are fine for a single beat, but at most twice each and never in two scenes in a row. `follow-outro` closes the video.
- Every time on screen sits on its word (±0.1 s of the word start in the trimmed transcript).

## 4. Footage

- The footage is the trimmed working clip `work/take-<ratio>.mp4`. One shot per scene with `from` = `at` = the scene start and `to` = the scene end, in trimmed time.
- Set each scene's `facePos` from the face track (it pans the full-frame crop and frames the 4:3 face card). **Never zoom into the face.** No punch-ins unless ticked.

## 5. Sound

One sound per visible action, matched to the gesture ([../../video-core/references/sfx.md](../../video-core/references/sfx.md)):
keys for typing, card slides for rows, chips for numbers, soft impacts for layout changes, a punch for stamps, a click
for the follow button. Pick 4–6 families for the whole video and rotate files inside them.

## 6. Before saving

1. `rf validate plan.json`: fix every error (variety errors name the repeat and what to do instead).
2. `rf gaps plan.json` must be `[]`. Fix gaps with real beats in the scene (another row, a recount, a stamp), never filler.
3. `rf save plan.json --request "first cut"`.
