# Cards

A card enters **on the word it illustrates** (within 0.1 s of that word's start in the transcript) and holds long
enough to read (about 0.5 s + 0.3 s per word on it). Enter slow, leave fast. Overlap the next element when the
previous one is about a third done. Every card that appears gets a sound from its family below. No whooshes.

Built-in cards take the video's look (`plan.look`, see [look.md](look.md)): card surface, ink, accent, radius.
In talking-head and app videos each built-in template appears **at most twice, never in two scenes in a row**
(`rf validate` enforces it); most beats are your own `custom-animation` scenes. Faceless B-roll reels are exempt.
Sounds: pick from the action in [sfx.md](sfx.md); the files below are only the defaults for faceless reels.

Card positions are in pixels of a 1080-wide frame; the compiler scales the built-in cards per ratio. A `custom-animation` is used exactly as written, so give it per-ratio `ratioOverrides` ([assets.md](assets.md)).

### `title-card`

A big tool/topic name with its logo tile and a yellow number badge. Use it when a list item is introduced ("Birincisi,
Fooocus"). It sits 260 px above centre.
Params: `{ "n": 1, "name": "Fooocus", "logo": "ext/fooocus_1.png", "logoFit": "cover", "logoPosition": "25% 20%" }`.
`logoFit: "contain"` insets a mark on the dark tile (e.g. the OpenAI glyph).
Sound: a ding (`sfx/ding/…`) at 0.30.

### `numbered-list`

The cumulative top-left list ("1. Fooocus 2. Whisper …"). One card per scene. An item whose `at` is before the card
start is already there; one at or after it slides in at `at`. Land each item as its title card leaves (title end
minus 2 frames).
Params: `{ "items": [{ "n": 1, "name": "Fooocus", "logo": "ext/fooocus_1.png", "at": 7.4667 }], "highlight": "latest" }`.
Use `"none"` for the closing scene (all white).
Sound: the video's one tick on each landing, at 0.25–0.3 (or none).

### `logo-pop`

An image card that pops in with a slight tilt (the hook's floating logos and screenshots). Keep it in the upper ~50 %, clear of captions.
Params: `{ "img": "ext/upscayl_banner.jpg", "left": 560, "top": 270, "width": 470, "height": 264, "rot": 5, "fit": "cover" }`.
`left`/`top` are the card's **top-left corner**, not its centre: `left: 540` puts the left edge in the middle and the
card sits to the right. **To centre a card horizontally, leave `left` out.** (Centre by hand: `left = 540 − width / 2`.)
Logos use `"fit": "contain"` and `"bg": "#121417"`; `"bg": "transparent"` shows just the logo (no tile, no border).
Sound: the video's one pop, at 0.35.

### Where the talking-head cards sit

`rolling-number`, `checklist`, `bar-chart`, `stamp`, `typed-title` and `follow-outro` take an optional **`y`**: the
card's vertical centre as a fraction of the frame height (`0.15` near the top, `0.5` the middle, `0.85` near the
bottom). Without it the card sits in its layout's region: on `full-face` that is the band under the captions (from
78 % of the height down), on `split` the top half. When the user asks to move a card up or down, set `y`; never
invent another param (`rf validate` refuses unknown params). Keep it clear of the captions and the face.

### `rolling-number`

Digits roll like a slot machine to the number being said (money, counts, percentages).
Params: `{ "from": 0, "to": 1000000, "locale": "tr-TR", "suffix": " ₺" }`.
Sound: a quiet `sfx/typing/fs-416777-digital-typing-wav.ogg` as it counts, a ding or pop on landing at 0.4.

### `checklist`

Rows that tick as each item is said ("Google ✓ Meta ✓ Unity ✓").
Params: `{ "items": [{ "label": "Google", "at": 15.9 }, { "label": "Meta", "at": 16.4 }] }`. Each `at` sits on the spoken word.
Sound: the video's one soft tick per row, at 0.25–0.3.

### `bar-chart`

Two or three bars growing to compare values ("%50 vs %70").
Params: `{ "bars": [{ "label": "Diğer", "value": 50 }, { "label": "Hedef ülke", "value": 70 }] }`.
Sound: one pop as the bars start, a tick on the highlighted bar, at 0.35.

### `stamp`

A punchline badge slammed onto the card ("%70 GERİ", "FREE").
Params: `{ "text": "%70 GERİ" }`, optionally `"y": 0.3` to place it higher.
Sound: `sfx/kit/impact.ogg` or `sfx/impact/fs524817.ogg` at 0.5 on the slam. **Once per video**: `rf validate` refuses a second stamp.

### `typed-title`

A name or term typed character by character, with a cursor ("Dijital Ürün Tanıtım Desteği").
Params: `{ "text": "Dijital Ürün Tanıtım Desteği", "label": "RESMİ ADI" }`.
Sound: one quiet typing cue at the start (`sfx/typing/…`) at 0.3.
Never type the line being spoken (captions show it); type a name, a term or a value the speaker refers to.

### `follow-outro`

The animated "Follow → Following" button at the end. The handle must be the creator's real handle.
Params: `{ "handle": "@erendevelops" }`, optionally `"y": 0.5` to centre it.
Sound: a click (`sfx/kit/click.ogg`, `sfx/click/…`) at 0.45 on the press.

### `custom-animation`

Your own scene: value cards that count, lists that build and tick, comparisons, flags, before → after flows,
illustrated metaphors, app windows, rebuilt app screens acting. You write it with a scene script ([assets.md](assets.md)).
It needs **topic assets** ticked. This is the main tool for talking-head and app videos.
Params: `{ "html": "…", "css": "…", "script": "…", "beats": [ … ], "label": "…" }`.
Sound: only the moments that matter, from the video's small palette ([sfx.md](sfx.md)).
