# Music

Only when the **music bed** card is ticked. Otherwise there is no music, and you don't mention it.

## 1. Suggest (analyse stage)

Search royalty-free libraries that allow commercial use without attribution (for example Pixabay Music) for 3–4
tracks that fit the video's mood and length. Write `analysis/music-candidates.json`:

```json
{
  "candidates": [
    { "title": "Ambient Minimal Technology", "artist": "…", "url": "https://pixabay.com/music/…", "license": "Pixabay Content License (no attribution)", "why": "minimal, premium, clear build into a drop at ~7.5 s", "contentId": true }
  ]
}
```

- Every candidate needs an https `url`, the licence in words, and one line of `why`.
- Set `contentId: true` when the track is registered with YouTube Content ID, so the user knows.
- "Premium / Apple-style" means minimal modern electronic with a clear build. It does not mean upbeat stock "corporate happy" music.
- Don't download anything yet. The user picks in the app.

## 2. Align (plan stage, after the user picked)

The picked file is in `inputs/music/`.

1. Run `rf beats inputs/music/<file>` to get `bpm`, `beats` and `drop`.
2. Set `music.mediaStart` so the drop lands on the reveal (the hook → reveal seam): `mediaStart = drop − revealTime`.
3. Put scene seams on beats. Beat-lock the strongest moments (reveal, punchline, outro).
4. Keep music well under the effects: `music.volume` around 0.08–0.12 for a loud master. The aim is music-only stretches near −30 dB mean, with effects clearly on top. `fadeOut` 1.5 s.
