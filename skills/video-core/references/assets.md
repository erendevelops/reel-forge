# Assets

## Logos of named products (topic assets)

When the transcript or the brief names a product, brand or tool, show its **official** logo on the word.

1. Run `rf logo <name>`. If it returns `found: true`, use `"si:<slug>"` as the card's `logo` or `img`. This needs topic assets ticked.
2. If it returns `{ "found": false }`, find the official asset yourself:
   - Find the repo: `https://api.github.com/search/repositories?q=<tool>`, top result by stars.
   - List images: `GET /repos/{repo}/git/trees/{branch}?recursive=1`, filtered to `\.(png|svg|jpg|webp)$` with `logo|icon|banner` in the path.
   - Fallback: README `<img src>` and markdown image URLs, or the product site's favicon / Open Graph image.
   - Download into `assets/ext/` and record the source URL and licence in `analysis/assets.json`.
3. **Never invent, redraw or approximate a logo.** If nothing official exists, use a real screenshot or a `typed-title` of the name instead.

## External images

Product screenshots, sample outputs and banners come from the product's own repo or site, saved under `assets/ext/`
with their source in `analysis/assets.json`. Prefer an image that shows a *result* (generated images, before/after)
over one that shows text.

## Writing a `custom-animation`

A `custom-animation` card is a small HTML/SVG scene plus a GSAP timeline that you write. It is checked against a
strict allowlist (`rf validate` reports every violation):

- **`timeline`**: only top-level calls `tl.fromTo("<selector>", {from}, {to}, <seconds>)`, `tl.to(...)` and `tl.set(...)`.
  Times are **relative to the card start**. Values must be literals (numbers, strings, booleans, nested objects/arrays):
  no variables, loops, functions, arithmetic, template strings, `random`, or callbacks (`onComplete`…).
- **`html`**: plain HTML/SVG elements with quoted attributes. No `<script>`, `<iframe>` or `on*` handlers, and no URLs except relative asset paths.
- **`css`**: flat `selector { … }` rules. `url()` only for `#id` or a relative asset path. No `@import` or comments.
- Selectors are scoped to the card automatically. Ids and classes are namespaced, so keep them short.
- Never use `from` (only `fromTo`/`set`): scenes are re-seeked and `from` renders wrong.

A growing bar with a label:

```fragment-json
{
  "duration": 2.5,
  "html": "<div class=\"bar\"></div><div class=\"lab\">%70</div>",
  "css": ".bar { position: absolute; left: 140px; bottom: 120px; width: 160px; height: 400px; background: #F5B700; border-radius: 12px; transform-origin: 50% 100%; } .lab { position: absolute; left: 140px; bottom: 540px; width: 160px; text-align: center; font: 800 64px Inter; color: #111827; opacity: 0; }",
  "timeline": "tl.fromTo(\".bar\", {scaleY: 0}, {scaleY: 1, duration: 0.8, ease: \"expo.out\"}, 0.1); tl.fromTo(\".lab\", {opacity: 0, y: 20}, {opacity: 1, y: 0, duration: 0.4, ease: \"power3.out\"}, 0.6);"
}
```

A three-step flow diagram that lights up step by step:

```fragment-json
{
  "duration": 3,
  "html": "<div class=\"s s1\">Prompt</div><div class=\"s s2\">Model</div><div class=\"s s3\">Image</div>",
  "css": ".s { position: absolute; top: 300px; width: 260px; height: 120px; border-radius: 18px; background: #fff; color: #111827; font: 700 40px Inter; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 30px rgba(0,0,0,.12); opacity: 0.25; } .s1 { left: 60px; } .s2 { left: 410px; } .s3 { left: 760px; }",
  "timeline": "tl.fromTo(\".s1\", {opacity: 0.25, scale: 0.9}, {opacity: 1, scale: 1, duration: 0.4, ease: \"expo.out\"}, 0.2); tl.fromTo(\".s2\", {opacity: 0.25, scale: 0.9}, {opacity: 1, scale: 1, duration: 0.4, ease: \"expo.out\"}, 0.9); tl.fromTo(\".s3\", {opacity: 0.25, scale: 0.9}, {opacity: 1, scale: 1, duration: 0.4, ease: \"expo.out\"}, 1.6);"
}
```

The `duration` field above only exists for these examples; in a plan the card's `end − start` is the duration.
