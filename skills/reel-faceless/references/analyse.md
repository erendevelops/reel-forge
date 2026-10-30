# Analyse a faceless reel

## 1. Footage

For every clip in `inputs/`:

1. `rf probe <clip>`: note duration, rotation (iPhone `.MOV` is often stored rotated; working clips fix it), fps, colour range and audio.
2. `rf sheet <clip> analysis/sheets/<name>.jpg --every <s>`: every 6 s for clips over a minute, every 2 s for short ones. Read each sheet as an image.
3. Write what you see into `analysis/clips.json`: `[{ "file", "duration", "content", "role", "moments": [{ "at", "what" }] }]`.
   - `role`: hook / tool N / CTA / signature shot.
   - `moments`: stretches where the wanted content is on screen for a whole shot. To pick exact in-points, re-sheet a 3 s candidate range at 0.25 s steps.

Camera audio is not used (the voiceover is the sound).

## 2. Voiceover

1. `rf transcribe <vo> --lang <project language> --prompt "<every tool / product / proper noun you can see in the clips>"`. Save the output to `analysis/transcript.json`.
2. Whisper mishears names and rare words. Write `analysis/transcript-review.json` (`{ "words": [{ "w", "start", "end", "suspect": bool }] }`), marking every word you doubt as `suspect`. The app asks the user to correct the text. **Keep Whisper's timestamps and the user's words.**
3. If the user's script and the audio disagree, captions follow the audio. Say so in your reply.
4. Find the structure: hook → items (ordinal words such as "Birincisi / İkinci / First / Second" followed by a proper noun) → CTA.

## 3. Reference reels (only if `inputs/references/` exists)

For each reference: `rf sheet` every 1 s, `rf cuts` for the average shot length, and `rf transcribe` for how captions relate to speech.
Write `analysis/style.md` covering shots, caption style, overlays, title moments, CTA and pacing.

**Take the structure from references and the pacing from the user's preferences.** Creators often reject a
reference's fast pacing; their preferences in `CLAUDE.md` win.

## 4. Music

Only if ticked; see [../../video-core/references/music.md](../../video-core/references/music.md).

End the stage with a 5-line summary: clips mapped, transcript words flagged, structure found, references read, open questions.
