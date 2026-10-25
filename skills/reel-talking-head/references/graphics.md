# Graphics look (talking head)

From the two reference reels (spec §13):

- **@onur.builds:** a warm beige panel (`#F7F3EA`) fills the top; the face sits in a rounded card at the bottom; white cards with soft shadows; numbers roll; checklists tick; a green stamp ("%70 GERİ") slams down; bars grow; flags and logos sit in rows. Single-word captions, yellow with a dark outline.
- **@msevimli_:** illustrated line-art scenes and mock app windows carry the middle with no face at all, and an animated "Follow → Following" button closes it. Small single-word captions with serif-italic emphasis.

## When to use which layout

- `full-face`: the hook and the outro, plus moments of personal emotion ("I was nervous too").
- `split`: whenever a card explains what is being said. This is most of the body.
- `full-graphics`: one beat (2–4 s) where an animation explains a concept better than the face does.
- `broll`: only if the take has the creator's own cutaways and the layout is ticked.

## Card styling

- Cards enter with a short, soft scale/slide (about 0.4 s `expo.out`) and leave faster (about 0.2 s).
- Hold every card long enough to read.
- At most 2 cards are visible at once in a split panel. Stack them vertically, newest on top, and let the oldest leave.
- Logos in rows (Google, Meta, TikTok …) are a `checklist` whose labels are the names, with a `logo-pop` per logo if they need their marks.
- `custom-animation` scenes use the same palette: beige ground, `#111827` ink, `#1F9D6E` accent, white cards.
