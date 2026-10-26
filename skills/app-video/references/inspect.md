# Inspect the product

The repo is in `inputs/` (often a copied project folder). Screenshots may be next to it.

## Read, in this order

1. **The product's own words:**
   - i18n/string files in the project language (`tr.json`, `en.json`, `Localizable.strings`…);
   - the store listing (`docs/app-store/*`, `fastlane/metadata`);
   - the README;
   - the landing page's hero and section headings.

   These are the only claims you may put on screen. Framing questions ("Bu ay nereye gitti?") are fine.
2. **Brand tokens:** theme/token files (`tokens.ts`, `theme.ts`, `tailwind.config`, CSS `:root` variables) for ground, surface, ink, secondary and accent colours, plus semantic colours (success, warning, danger), font families and corner radius.
3. **Icons and logo:** the app's own SVG paths and icon set. Keep logos as their original SVG.
4. **The flow in use:** routes and screens beyond marketing (`app/`, `screens/`, the main store or state machine), and the key components (an add sheet, a list, a dashboard, a recap). Find the 2–3 beats of **using** it: entry → key action → result.
5. **The components you'll rebuild:** for each screen in the flow, open its component file and write its real values into `analysis/components.md`: colours, radius, padding, font sizes/weights, icon SVG paths, strings, number format. Compare with the screenshots (`rf sheet` or read the images) so the rebuild matches what users actually see.
6. **Demo data:** seed or fixture data and screenshots, for realistic numbers. All numbers on screen come from here; never invent personal data.

## Write `analysis/product.json`

```json
{
  "name": "prao",
  "oneLine": "A calm iPhone money tracker: log spending in seconds, see where it went.",
  "rubric": {
    "what": "…", "strongestClaim": "…", "visualHook": "…", "showFromUI": ["add sheet", "budget rings", "calendar", "recap"],
    "length": 23, "tone": { "preset": "app-store", "direction": "Apple-keynote product film" },
    "audio": "warm minimal bed; UI clicks only where something is pressed",
    "shareCaption": "…",
    "flow": ["enter 1-8-0", "tap Kahve, Kaydet", "row lands in Son işlemler"]
  },
  "brand": { "ground": "#0B0B0C", "surface": "#18181B", "ink": "#FAFAFA", "secondary": "#8E8E93", "accents": { "expense": "#F87171" }, "font": "Inter", "radius": 16 },
  "copy": ["Bugün harcayabileceğin", "Son işlemler", "Kaydet"],
  "assets": { "logo": "inputs/…/Logo.svg", "screenshots": ["inputs/shots/home.jpg"] }
}
```

The rubric has nine questions: what it is; the most striking claim or number; the visual hook; what to show from the
UI; the shortest satisfying length; the tone (preset + one-line direction); what the audio should feel like; the
share caption; and the user flow worth showing. Answer all nine before planning.

If music is ticked, also write the candidates ([../../video-core/references/music.md](../../video-core/references/music.md)).
