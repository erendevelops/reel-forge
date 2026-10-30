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
2. Whisper mishears names and rare words. Write `analysis/transcript-review.json` (`{ "words": [{ "w", "start", "end", "suspect": bool }] }`), marking every word you doubt as `suspect`. The app asks the user to correct the text and saves it into `analysis/transcript.json`. **Keep Whisper's timestamps and the user's words.**
3. If the user's script and the audio disagree, captions follow the audio. Say so in your reply.
4. Find the structure: hook → items (ordinal words such as "Birincisi / İkinci / First / Second" followed by a proper noun) → CTA.

## 3. Reference reels (when the project has them; downloaded into `analysis/refs/`)

The user gave a reference because they want **their video to look and move like it.** For each reference: `rf sheet`
every 0.5 s in 10 s chunks (look at every sheet), `rf cuts` for the shot length, `rf transcribe` for how captions follow speech.

Write `analysis/style.md` as a **recipe to rebuild it**, not a summary:
1. **Beat by beat** (a table): time, what is said, exactly what is on screen (background, every element, its
   position, size, colours, font style), and how it moves in and out (pop, slide, type-on, morph, cursor click…).
2. **The look:** background colours (hex, read from the frames), type (sans/serif, weight, italic emphasis words),
   caption position and size, how footage is framed (full screen, inset card, rounded corners, none at all).
3. **Techniques to copy:** each recurring trick by name with how to build it here (`custom-animation` for illustration
   worlds, mini UIs, ghost words, cursor clicks; `title-card`, `logo-pop`, `follow-outro` where they match).
4. **Differences:** what the reference has that our footage can't give, and the closest substitute.

Pacing: the user's preferences in `CLAUDE.md` win over the reference's speed. Everything else follows the reference.

## 4. Music

Only if ticked; see [../../video-core/references/music.md](../../video-core/references/music.md).

End the stage with a 5-line summary: clips mapped, transcript words flagged, structure found, references read, open questions.
