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
Sound: `sfx/maximize_006.wav` at 0.30.

### `numbered-list`

The cumulative top-left list ("1. Fooocus 2. Whisper …"). One card per scene. An item whose `at` is before the card
start is already there; one at or after it slides in at `at`. Land each item as its title card leaves (title end
minus 2 frames).
Params: `{ "items": [{ "n": 1, "name": "Fooocus", "logo": "ext/fooocus_1.png", "at": 7.4667 }], "highlight": "latest" }`.
Use `"none"` for the closing scene (all white).
Sound: `sfx/pluck_002.wav` at 0.35 on each landing.

### `logo-pop`

An image card that pops in with a slight tilt (the hook's floating logos and screenshots). Keep it in the upper ~50 %, clear of captions.
Params: `{ "img": "ext/upscayl_banner.jpg", "left": 560, "top": 270, "width": 470, "height": 264, "rot": 5, "fit": "cover" }`.
Logos use `"fit": "contain"` and `"bg": "#121417"`; `"bg": "transparent"` shows just the logo (no tile, no border).
Sound: `sfx/drop_001.wav` … `drop_004.wav` at 0.45, varied.

### `rolling-number`

Digits roll like a slot machine to the number being said (money, counts, percentages).
Params: `{ "from": 0, "to": 1000000, "locale": "tr-TR", "suffix": " ₺" }`.
Sound: `casino/chip-lay-*` at 0.45 on landing.

### `checklist`

Rows that tick as each item is said ("Google ✓ Meta ✓ Unity ✓").
Params: `{ "items": [{ "label": "Google", "at": 15.9 }, { "label": "Meta", "at": 16.4 }] }`. Each `at` sits on the spoken word.
Sound: a different soft tick per row (`ui/rollover2.ogg`, `interface/click_003.ogg`, `pluck_002.wav`, `impact/impactGlass_light_00*`) at 0.35–0.45.

### `bar-chart`

Two or three bars growing to compare values ("%50 vs %70").
Params: `{ "bars": [{ "label": "Diğer", "value": 50 }, { "label": "Hedef ülke", "value": 70 }] }`.
Sound: `casino/chips-stack-*` at 0.4 as the bars grow.

### `stamp`

A punchline badge slammed onto the card ("%70 GERİ", "FREE").
Params: `{ "text": "%70 GERİ" }`.
Sound: `impact/impactPunch_medium_*` or `impact/impactPlate_medium_*` at 0.5 on the slam.

### `typed-title`

A name or term typed character by character, with a cursor ("Dijital Ürün Tanıtım Desteği").
Params: `{ "text": "Dijital Ürün Tanıtım Desteği", "label": "RESMİ ADI" }`.
Sound: `keyboard/keypress-*` per character (a different file each, thin out on long text) at 0.4.
Never type the line being spoken (captions show it); type a name, a term or a value the speaker refers to.

### `follow-outro`

The animated "Follow → Following" button at the end. The handle must be the creator's real handle.
Params: `{ "handle": "@erendevelops" }`.
Sound: `sfx/drop_002.wav` at 0.45 on the press.

### `custom-animation`

Your own scene: value cards that count, lists that build and tick, comparisons, flags, before → after flows,
illustrated metaphors, app windows, rebuilt app screens acting. You write it with a scene script ([assets.md](assets.md)).
It needs **topic assets** ticked. This is the main tool for talking-head and app videos.
Params: `{ "html": "…", "css": "…", "script": "…", "beats": [ … ], "label": "…" }`.
Sound: one per visible action, matched to the gesture ([sfx.md](sfx.md)).
