# The plan contract (`plan.json`)

`rf validate` is the authority. This page explains what each field means.

## Top level

| Field | Type | Meaning |
|---|---|---|
| `version` | `1` | Contract version |
| `lang` | BCP-47 tag (`tr`, `en`) | Spoken language: captions and uppercase card text follow it (Turkish i → İ) |
| `mode` | `reel` \| `app` | Reel = footage + voice; app = rebuilt product UI |
| `fps` | `30` \| `60` | Reels 60, app videos 30 |
| `duration` | seconds | Must equal the last scene's `end` |
| `ratios` | `9:16` `4:5` `1:1` `16:9` | Every ratio is laid out again, never cropped |
| `selection` | object | The user's option cards. Copy it from `rf project`, never change it |
| `scenes` | array | Contiguous: the first starts at 0, each starts where the previous ends |
| `captions` | `{ style, groups }` | `groups`: `{ words: [[word, startSec], …], end }`. Each group ends when the next starts |
| `sfx` | `{ file, at, volume }[]` | Sound cues (`sfx/drop_001.wav` etc. are bundled), volume 0.25–0.6 |
| `voice` | `{ src }` | The voiceover or camera audio (path relative to the project's `inputs/`) |
| `music` | `{ src, mediaStart, volume, fadeOut }` | Only if the music card is ticked and the user picked a track |
| `cover` | `{ at, title, kicker?, position?, logo? }` | The cover image, **required when the cover (thumbnail) card is ticked**: the frame at `at` (timeline s) under a scrim with a bold white headline, a short accent bar above it, and 1–2 key words in accent colour via `*…*` (style `accent`, the default; `card` and `clean` only if the user asks). `title` = one plain sentence of what the video gives the viewer (e.g. "Edit your videos with Claude"), not the video's first line, no clickbait. No `kicker` unless the user asks, never a filler one like "YENİ". `position` `top`/`center`/`bottom` (default bottom; a learned preference overrides it): put the text where the frame is empty. `logo` = asset path or `si:<slug>` (topic assets). Pick a frame that is sharp, bright and shows the subject; no text or cards are drawn from the video, only the frame |
| `look` | `{ background, ink? }` hex | Colours of the graphics panel. **Required for app videos** (the brand's ground and ink) |

## Scenes

| Field | Meaning |
|---|---|
| `id`, `start`, `end` | Seconds on the timeline |
| `say` | The words spoken in this scene (for the storyboard) |
| `why` | One sentence the user reads: why this scene looks like this |
| `layout` | `full-face` \| `split` \| `full-graphics` \| `broll`. Must be ticked |
| `facePos` | `{x, y}` 0–1, the face centre (from `rf facetrack`). Pans a full-frame cover; never zooms |
| `shots` | `{ src, from, to, at, punch?, aspect? }`. `from`/`to` = **source** in/out; `at` = **timeline** start; `punch` = timeline time of a soft punch-in (only if punch-ins are ticked); `aspect` = the clip's own w/h when it isn't a working clip at the output size |
| `cards` | `{ type, start, end, params }`. Must sit inside the scene; `type` must be ticked; `params` per [cards.md](cards.md) |
| `ratioOverrides` | `{ "4:5": { … } }` merged into each card's params for that ratio |

Everything is in **seconds** (floats). Frames only exist at render time.

## Paths

`src`, `img` and `logo` are relative to the project's `inputs/` folder (e.g. `public/s01.mp4`, `work/s03.mp4`, `ext/logo.png`).
`si:<slug>` is a logo resolved by `rf logo` (needs topic assets ticked). `sfx/...` resolves to the bundled sounds.

## A complete minimal example

```plan-json
{
  "version": 1, "lang": "en", "mode": "reel", "fps": 60, "duration": 6, "ratios": ["9:16"],
  "selection": { "captions": "word-build", "layouts": ["broll"], "cards": ["title-card"], "sfx": true, "music": false, "punchIns": false, "thumbnail": true, "topicAssets": false },
  "scenes": [
    { "id": "hook", "start": 0, "end": 3, "say": "Five free AI tools", "why": "Signature desk shot opens the reel", "layout": "broll",
      "shots": [{ "src": "public/s01.mp4", "from": 0, "to": 3, "at": 0 }], "cards": [] },
    { "id": "tool-1", "start": 3, "end": 6, "say": "First, Fooocus", "why": "Title card lands on the tool name", "layout": "broll",
      "shots": [{ "src": "public/s03.mp4", "from": 0, "to": 3, "at": 3 }],
      "cards": [{ "type": "title-card", "start": 3.4, "end": 4.4, "params": { "n": 1, "name": "Fooocus" } }] }
  ],
  "captions": { "style": "word-build", "groups": [
    { "words": [["Five", 0.1], ["free", 0.4], ["AI", 0.7], ["tools", 0.9]], "end": 3 },
    { "words": [["First,", 3.1], ["Fooocus.", 3.4]], "end": 6 }
  ] },
  "sfx": [{ "file": "sfx/maximize_006.wav", "at": 3.4, "volume": 0.3 }],
  "voice": { "src": "public/vo.wav" }
}
```


