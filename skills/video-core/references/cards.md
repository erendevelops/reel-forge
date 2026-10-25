# Cards

A card enters **on the word it illustrates** (within 0.1 s of that word's start in the transcript) and holds long
enough to read (about 0.5 s + 0.3 s per word on it). Enter slow, leave fast. Overlap the next element when the
previous one is about a third done. Every card that appears gets a sound from its family below. No whooshes.

Positions are in pixels of a 1080-wide frame unless noted. The compiler scales them per ratio.

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
Logos use `"fit": "contain"` and `"bg": "#121417"`.
Sound: `sfx/drop_001.wav` … `drop_004.wav` at 0.45, varied.

### `rolling-number`

Digits roll like a slot machine to the number being said (money, counts, percentages).
Params: `{ "from": 0, "to": 1000000, "locale": "tr-TR", "suffix": " ₺" }`.
Sound: `sfx/drop_003.wav` at 0.4 on landing.

### `checklist`

Rows that tick as each item is said ("Google ✓ Meta ✓ Unity ✓").
Params: `{ "items": [{ "label": "Google", "at": 15.9 }, { "label": "Meta", "at": 16.4 }] }`. Each `at` sits on the spoken word.
Sound: `sfx/pluck_002.wav` at 0.35 per tick.

### `bar-chart`

Two or three bars growing to compare values ("%50 vs %70").
Params: `{ "bars": [{ "label": "Diğer", "value": 50 }, { "label": "Hedef ülke", "value": 70 }] }`.
Sound: `sfx/drop_002.wav` at 0.4.

### `stamp`

A punchline badge slammed onto the card ("%70 GERİ", "FREE").
Params: `{ "text": "%70 GERİ" }`.
Sound: `sfx/drop_004.wav` at 0.5.

### `typed-title`

A name or term typed character by character, with a cursor ("Dijital Ürün Tanıtım Desteği").
Params: `{ "text": "Dijital Ürün Tanıtım Desteği", "label": "RESMİ ADI" }`.
Sound: none per key unless the scene is quiet; `sfx/drop_001.wav` at 0.3 when it starts.

### `follow-outro`

The animated "Follow → Following" button at the end. The handle must be the creator's real handle.
Params: `{ "handle": "@erendevelops" }`.
Sound: `sfx/drop_002.wav` at 0.45 on the press.

### `custom-animation`

Anything the cards above can't show: a flow, a simulation, a rebuilt app screen. You write it ([assets.md](assets.md)).
It needs **topic assets** ticked.
Params: `{ "html": "…", "css": "…", "timeline": "…", "label": "…" }`.
Sound: from the action shown (tap → `drop_002`, landing → `drop_003`, reveal → `maximize_006`).
