# Analyse a talking-head take

1. `rf probe` every take, and `rf sheet <take> analysis/sheets/<name>.jpg --every 2` to see framing, cutaways and any baked-in text.
2. `rf transcribe <take> --lang <spoken language> --prompt "<names you can guess from the sheets>"` → save as `analysis/transcript.json`.
3. `rf trims analysis/transcript.json` → `analysis/trims.json`: the kept ranges after dead air (gaps over 0.35 s). Mark obvious retakes (a sentence restarted) as removed ranges too. Cut only between words.
4. `rf facetrack <take> analysis/face-track.json`, then `rf crop analysis/face-track.json --ratio <r>` for every project ratio → `analysis/face-<ratio>.json`.
   - The crop is always the **widest window the ratio allows** (full source height for horizontal → vertical). It only pans to keep the face in frame. Never crop tighter.
   - Use the median face centre as each scene's `facePos`.
5. Cut the dead air: `rf trimtake <take> analysis/trims.json inputs/work/take-trimmed.mp4 --transcript analysis/transcript.json`. From here on, **everything uses trimmed time**: the trimmed take and `analysis/transcript-trimmed.json` (words re-timed onto it). Run `rf facetrack` and `rf crop` on the trimmed take (step 4 order: trim first, then track).
6. Working clips per ratio: `rf prep inputs/work/take-trimmed.mp4 inputs/work/take-<r>.mp4 --from 0 --duration <trimmed length> --ratio <r> --fps 60 --crop analysis/face-<r>.json`.
7. **Topics:** read the transcript and list every product, brand, tool, number and claim with its word time in `analysis/topics.json`:
   ```json
   { "topics": [{ "at": 3.42, "kind": "product", "text": "ChatGPT" }, { "at": 7.1, "kind": "number", "text": "1.000.000 ₺" }, { "at": 9.8, "kind": "claim", "text": "devlet %70'ini geri ödüyor" }, { "at": 14.2, "kind": "concept", "text": "masa = klasör" }] }
   ```
   For each `product`, run `rf logo <text>` now and note `found`.
8. If the user gave reference reels (in `inputs/` or linked in the brief), watch them densely (`rf sheet <ref> analysis/ref-<n>-<t>.jpg --every 0.5 --from <t> --to <t+10>` per 10 s) and write `analysis/references.md` ([../../video-core/references/look.md](../../video-core/references/look.md) §3).
9. Write `analysis/beats.md` (what to draw per sentence) and `analysis/kit.md` ([plan.md](plan.md) §1–2).
10. Write a 5-line summary: length after trims, cuts removed, face found in what share of samples, topics found, logos found/missing.
