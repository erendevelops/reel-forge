# Storyboard

Write `analysis/storyboard.md` (the app shows it to the user) before any `plan.json`.

## Shape

```
Hook (≤3 s) → Reveal (2–4 s) → 2–3 product moments (entry → action → result, 4–5 s each) → Punchline (≈3 s) → Outro (≈3 s)
```

The total is 15–25 s. Adapt the shape, but keep these laws:

- **The hook is everything.** The first 2 s show the most striking number or claim from `product.json`, moving, not a logo. For prao: the month's spending rolling up in red, then "Bu ay nereye gitti?".
- **Show the thing.** At least two scenes show the real UI rebuilt and acting; the user flow from the rubric is the centrepiece.
- **Specific, never generic.** Use the product's actual copy and numbers. "Streamline your workflow" and similar are banned.
- **Readable.** A label holds about 0.8 s settled and a sentence about 0.3 s per word. Fast in, then hold.
- **Every claim is grounded.** Each on-screen line comes from `product.json.copy` or the listing, or is an obvious framing question.

## Per scene, write

```markdown
### 3 · Log it · 5.53–10.02
On screen: the add sheet rises; 1-8-0 typed; 12 category tiles cascade; Kahve tapped (turns solid); Kaydet; the row drops into "Son işlemler".
Sequential / interaction: typing, tile cascade, tap, save, row landing.
Text: "Saniyeler içinde kaydet." / "Tutar, kategori, bitti."
Sound: key ticks per digit; click on the tap and the save; soft drop when the row lands.
Transition (with a cause): the saved row grows into the next card.
```

## Music (if ticked and picked)

Run `rf beats`, offset `mediaStart` so the drop lands on the reveal, and put scene seams on beats. Beat-lock the
reveal, the punchline and the outro.

## Poster and share copy

Name the settled outro frame the poster comes from (`why` of the outro scene) and write `analysis/share-copy.txt`
(one sentence, the product's voice, not corporate).
