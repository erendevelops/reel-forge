# Assets

## Logos of named products (topic assets)

When the transcript or the brief names a product, brand or tool, show its **official** logo on the word.

1. Run `rf logo <name>`. If it returns `found: true`, use `"si:<slug>"` as the card's `logo` or `img`. This needs topic assets ticked.
2. If it returns `{ "found": false }`, find the official asset yourself:
   - Find the repo: `https://api.github.com/search/repositories?q=<tool>`, top result by stars.
   - List images: `GET /repos/{repo}/git/trees/{branch}?recursive=1`, filtered to `\.(png|svg|jpg|webp)$` with `logo|icon|banner` in the path.
   - Fallback: README `<img src>` and markdown image URLs, or the product site's favicon / Open Graph image.
   - Download into `inputs/ext/` and reference it as `ext/<file>` (plan paths are relative to `inputs/`). Record the source URL and licence in `analysis/assets.json`.
3. **Never invent, redraw or approximate a logo.** If nothing official exists, use a real screenshot or a `typed-title` of the name instead.

## External images

Product screenshots, sample outputs and banners come from the product's own repo or site, saved under `inputs/ext/`
with their source in `analysis/assets.json`. Prefer an image that shows a *result* (generated images, before/after)
over one that shows text.

### Images from the web for what is being said

When a sentence names a concrete thing the footage doesn't show (a product, device, object, place, person, app
screen), show a real picture of it on that word instead of leaving footage alone:

1. Find it: WebSearch, then take the image from the official site or press kit, or Wikimedia Commons. Open the page
   with WebFetch and use the **direct** image URL (`.png`/`.jpg`/`.webp`), the largest one offered.
2. `rf fetch <url> --name <short-name> --license "<licence or 'official press kit'>"` → `ext/<short-name>.<ext>`.
3. A photo of an object or person on a background: `rf cutout ext/<short-name>.jpg` → `ext/<short-name>-cut.png`
   (transparent, border cropped). Skip it for logos with their own transparency, screenshots and full scenes.
4. Show it: a `logo-pop` with `"bg": "transparent"` (`img: "ext/<short-name>-cut.png"`) popping in on the word, or
   inside a `custom-animation` (`<img src="ext/…">`) for a slide, float or stack. Animate it in, never just appear.
5. Never use stock-photo watermarks, AI-generated look-alikes, or images whose licence forbids reuse. If
   `rf cutout` fails (rembg not installed), use the image uncut in a framed card instead.

## Writing a `custom-animation` (your own scene)

Most beats of a talking-head or app video are your own scenes. A `custom-animation` card is HTML/SVG + CSS plus a
**scene script** that builds and animates it. Params:

```json
{ "html": "…", "css": "…", "script": "…", "beats": [0.4, 1.6, 2.3], "label": "ad spend calculator" }
```

- `html`: the static part (HTML/SVG elements, quoted attributes, `<img src="ext/shot.jpg">` for real images relative to `inputs/`). No `<script>`, `on*` handlers or URLs. Strip `xmlns="http://…"` from pasted SVGs.
- `css`: flat `selector { … }` rules, scoped to the card. Use the kit variables: `var(--card)`, `var(--ink)`, `var(--muted)`, `var(--accent)`, `var(--positive)`, `var(--negative)`, `var(--radius)`, `var(--bg)`. No `@` rules, comments, `animation`/`transition`.
- `script`: plain JavaScript, run once when the page loads. Loops, arithmetic, helper functions and DOM building (`document.createElement`, `stage.appendChild`, `el.innerHTML = …`) are all fine. In scope:

| Name | What |
|---|---|
| `tl.fromTo(target, from, to, at)`, `tl.to(target, vars, at)`, `tl.set(target, vars, at)` | GSAP tweens. `at` = seconds from the card start, **required**. `target`: a selector inside the card, an element, or an array |
| `$(sel)`, `$$(sel)` | query inside the card (first / all). `#id` means the html's own ids |
| `stage`, `W`, `H`, `D` | the card's stage element, its size in px, the card duration in s |
| `count(target, from, to, at, dur, { locale, decimals, prefix, suffix })` | a number counting up (`1.000.000 ₺`), eased, frame-accurate |
| `type(target, text, at, charsPerSecond)` | text typed character by character |
| `rand()` | seeded random 0–1 (same every render): jitter, scatter, confetti |
| `kit` | the look tokens as values (`kit.accent`) |
| `gsap.utils` | GSAP's helpers (`interpolate`, `clamp`, `mapRange`, …) |

  Not allowed (scenes are rendered by seeking frame by frame): `Date`, `Math.random`, timers, `onUpdate`/`onComplete` callbacks, the global `gsap.to`, `window`/`document.querySelector` (stay inside the card), network. `rf validate` reports each one.
- `beats`: card-relative times of the visible beats inside the scene (a row lands, a tick, a stamp). `rf gaps` counts them, so a 10 s scene that keeps building is not a "static" stretch.
- Never use `from()` (only `fromTo`/`to`/`set`). Text changes (`textContent`) go through `tl.set` / `count` / `type`.
- Positions are pixels in the card's region (1080×960 for the top half of a 9:16 split, 1080×1920 full graphics, 1920×1080 on 16:9). For several ratios put a per-ratio `html`/`css`/`script` in the scene's `ratioOverrides`.

### Example: a value card that counts, a derived card and a stamp (onur.builds)

```fragment-json
{
  "html": "<div class=\"card spend\"><div class=\"chip\">📣</div><div><div class=\"lab\">REKLAM HARCAMAN</div><div class=\"val\" id=\"spend\">0 ₺</div></div></div><div class=\"link\"></div><div class=\"card back\"><div class=\"chip\">🏛</div><div><div class=\"lab\">DEVLET GERİ ÖDER</div><div class=\"val\" id=\"back\">0 ₺</div></div></div><div class=\"stamp\">%70 GERİ</div>",
  "css": ".card { position: absolute; left: 90px; width: 900px; height: 190px; display: flex; align-items: center; gap: 28px; padding: 0 40px; background: var(--card); border-radius: var(--radius); box-shadow: 0 14px 40px rgba(0,0,0,.10); } .spend { top: 120px; } .back { top: 420px; background: var(--accent); } .chip { width: 84px; height: 84px; border-radius: 20px; background: rgba(0,0,0,.06); display: flex; align-items: center; justify-content: center; font-size: 44px; } .lab { font: 700 22px Inter; letter-spacing: 2px; color: var(--muted); } .back .lab { color: rgba(0,0,0,.55); } .val { font: 800 76px Inter; color: var(--ink); } .link { position: absolute; left: 520px; top: 330px; width: 40px; height: 70px; border-left: 4px dashed var(--muted); } .stamp { position: absolute; left: 700px; top: 600px; padding: 10px 26px; border: 6px solid var(--positive); border-radius: 18px; color: var(--positive); font: 900 54px Inter; background: var(--card); }",
  "script": "tl.fromTo('.spend', { x: -260, rotation: -4, opacity: 0 }, { x: 0, rotation: 0, opacity: 1, duration: 0.6, ease: 'expo.out' }, 0);\ncount('#spend', 0, 1000000, 0.2, 1.2, { suffix: ' ₺' });\ntl.fromTo('.link', { scaleY: 0, transformOrigin: '50% 0%' }, { scaleY: 1, duration: 0.3, ease: 'power2.out' }, 1.5);\ntl.fromTo('.back', { x: 260, rotation: 4, opacity: 0 }, { x: 0, rotation: 0, opacity: 1, duration: 0.6, ease: 'expo.out' }, 1.7);\ncount('#back', 0, 700000, 1.9, 1.0, { suffix: ' ₺' });\ntl.fromTo('.stamp', { scale: 1.8, rotation: -14, opacity: 0 }, { scale: 1, rotation: -6, opacity: 1, duration: 0.35, ease: 'back.out(2)' }, 3.0);",
  "beats": [0, 1.5, 1.7, 3.0]
}
```

Sounds for it: `casino/card-slide-2.ogg` at 0, `casino/chips-stack-2.ogg` at 0.2, `casino/card-slide-5.ogg` at 1.7, `impact/impactPunch_medium_001.ogg` at 3.0 (card times + the card start).

### Example: rows that join a list and tick on their words

```fragment-json
{
  "html": "<div class=\"head\">DESTEK NEYİ KAPSAR?</div>",
  "css": ".head { position: absolute; top: 40px; width: 100%; text-align: center; font: 700 22px Inter; letter-spacing: 3px; color: var(--muted); } .row { position: absolute; left: 90px; width: 900px; height: 104px; display: flex; align-items: center; gap: 24px; padding: 0 28px; background: var(--card); border-radius: 26px; box-shadow: 0 10px 30px rgba(0,0,0,.08); font: 700 40px Inter; color: var(--ink); } .ok { margin-left: auto; width: 54px; height: 54px; border-radius: 50%; background: var(--positive); color: #fff; display: flex; align-items: center; justify-content: center; font: 900 30px Inter; }",
  "script": "const items = [['Google', 0.3, 2.9], ['Meta', 0.8, 3.1], ['Unity', 1.3, 3.3], ['TikTok', 1.8, 3.5]];\nitems.forEach(([name, inAt, okAt], i) => {\n  const row = document.createElement('div');\n  row.className = 'row';\n  row.style.top = (110 + i * 124) + 'px';\n  row.innerHTML = '<span>' + name + '</span><span class=\"ok\">✓</span>';\n  stage.appendChild(row);\n  tl.fromTo(row, { x: 300, rotation: 3, opacity: 0 }, { x: 0, rotation: 0, opacity: 1, duration: 0.5, ease: 'expo.out' }, inAt);\n  tl.fromTo(row.querySelector('.ok'), { scale: 0 }, { scale: 1, duration: 0.3, ease: 'back.out(2.5)' }, okAt);\n});",
  "beats": [0.3, 0.8, 1.3, 1.8, 2.9, 3.1, 3.3, 3.5]
}
```

In a real plan every `inAt` / `okAt` is the spoken word's time (from the transcript) minus the card start.

### Craft

- Icons: small inline SVG line icons (24-unit viewBox, stroke 2, `stroke="currentColor"`), not emoji.
- Build the real object, not a caption: a card with an icon, a label and a value; a calendar with its cells; a phone with its keypad; a window with its title bar. Small details (an icon chip, a dashed empty state, a progress bar) make it read as designed.
- Keep a scene alive: let it accumulate (rows join), transform (a value recounts, a struck-through number turns into the corrected one) and only then leave.
- Enter slow, leave fast; overlap the next element when the previous one is a third done; titles land and stay still.
