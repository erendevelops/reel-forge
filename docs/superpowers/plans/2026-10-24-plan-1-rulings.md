# Plan 1 — rulings made during execution

Copied from the SDD ledger before deleting the workspace. Each: what was decided — why — cost if wrong.

- | T1 self | Step 1 says `git init`, but the repo already exists | Ruling below |
- | T4 self | committed TTS fixture; Turkish TTS voice may not exist on machine | Ruling below |
- | T5 self | needs Kenney SFX + fonts + gsap sources, unspecified where from | Ruling below |
- Ruling: Task 1 skips `git init` (repo + .gitignore already exist on branch plan-1-render-core); the implementer extends .gitignore — avoids clobbering — costs nothing if wrong.
- Ruling: Task 4 fixture: generate with OS TTS (Windows System.Speech); if no Turkish voice installed, use English "First Fooocus. Second Whisper." and run the test with lang 'en' — the test's intent (ordered word times, proper-noun prompt) is unchanged — cost if wrong: Turkish path only covered by the spikes.
- Ruling: Task 5 asset sources: Kenney SFX copied from ../video/reel/public/sfx (CC0, already converted to 48 kHz WAV) into assets/sfx; fonts and gsap come from npm (`@fontsource/inter`, `@fontsource/nunito`, `gsap@3.14.2`) and are copied into each compiled project at compile time, not committed — keeps the repo light and avoids redistributing fonts by hand — cost if wrong: one dependency swap.
- Ruling: numbered-list is modelled as one card per scene (validator keeps cards inside scenes): each card spans its scene (from the first item's landing in the Fooocus scene) with params `{ items: {n:number; name:string; logo:string; at:number}[]; highlight: 'latest'|'none' }`; items with at <= card.start render already-landed; CTA card uses highlight 'none' (all white at 28.2). Item landing = title end − 2 frames at 60 fps; pluck_002.wav cue at 0.35 on each landing — keeps the "cards stay in scene" invariant — cost if wrong: Task 5 template reshapes params.
- Ruling: list landing times follow the formula (title end − 2/60): 7.4667, 11.9167, 15.4667, 19.4667, 24.4667 — my listed literals were arithmetic slips — no cost.
- Ruling: no Turkish TTS voice installed (en-US David/Zira only) → fixture is tests/fixtures/speech-en.wav ("First Fooocus. Second Whisper."), test lang 'en'; global constraint's "only speech-tr.wav committed" reads as "only the speech fixture" — cost if wrong: rename.
- Ruling: Task 5 SFX copies only drop_001..004, maximize_006, pluck_002 (whoosh.wav excluded by the no-whoosh rule; click_00x files are app-video SFX, deferred to Plan 3) — cost if wrong: add files later.
- Ruling: numbered-list "already landed" is `item.at < card.start` (strict), so an item landing exactly at card start slides in — my earlier `<=` would never animate the v5 list — cost: none.
- Ruling: title card vertical position follows the v5 Remotion source (marginTop −260 inside a vertically centred flex column ⇒ visual centre ≈130 px above frame centre), not the doc's prose "260 px above centre" — the spike compares against the real v5 render — cost if wrong: one constant.
- Ruling: the npx-on-Windows launcher (node npx-cli.js) moves from tests/helpers to lib/media/npx.ts in Task 6, since render() needs it at runtime.
- Ruling: plan omitted the spec §12 duration gate — spec binds: QaExpect gains `duration` (= frames/fps); `format` checks container + audio + video stream durations within one frame (1/fps); the 3.1 s overrun must be fixed at its source (e.g. finishLoudness bounding output to video length), not tolerated — cost if wrong: small QA change.
- Ruling: confirmed by controller probe — libx264 in this ffmpeg 8.1 build drops -color_primaries/-color_trc (ffprobe: unknown). prepareClip (Task 3) is affected; it gets the same `-x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709` fix plus test assertions on primaries+transfer, carried in Task 7's fix round (same constraint, load-bearing for Spike A) — cost if wrong: none, tags are metadata only.
- Ruling: Task 7 card-compositing assertion uses PSNR (card frame ≥5 dB below clean) instead of the brief's 'yavg differs by > 1' — a small card moves whole-frame yavg only 0.88; PSNR is the stronger test of the same intent — cost: none.
- Ruling: when the 2%/sample rate limit and "face never cut off" conflict, containment wins — the crop may move faster than 2% only as far as needed to keep the face box (with margin) inside; spec §4.1 makes face-in-frame the bar, the rate limit is a smoothness heuristic — cost if wrong: occasional faster pans.
- Ruling: the split-layout face card must be face-aware (object-position from the face track) — "face never cut off" applies to every layout — carried into Task 8 fix round.
- Ruling: Spike A reference — ../video/output/ is empty (no v5 reel.mp4); render the v5 Remotion composition from ../video/reel with the reel doc §8.1 command into ../tbd-spike-media/v5-reference.mp4 as the comparison — cost: a few minutes of render.
- Ruling: confirm the implementer's overrule — DECISION hyperframes-layered, not remotion. The brief's whole-frame luma gate failed on all paths incl. v5 Remotion itself (worse there), and every failure is overlay pixels; footage-only, layered is exact (Δ 0.000) while single lifts blacks 3→10 / clips whites 249→240 (a real colour change). Spec's intent ("never alter footage colour") is met only by layered — cost if wrong: Plans 2–4 build on layered rendering (≈40% slower renders than single).
- Ruling: Spike A follow-up round (load-bearing for Task 10 + all later renders): footage-only luma gate; two-pass loudness finish (TP failed −1.41 vs −1.5 on all paths); delivery CRF for the composite (CRF 4 → 360 MB/32 s); v5 look parity — punch-in strength/speed, caption word gap, punctuation in captions, logo inset in ToolIcon.
- Ruling: Task 10 B-roll is omitted — the only user-approved footage is the single Trent Peek CC-BY clip; B-roll is optional in the preset and not part of the §4.1 bar — cost if wrong: B-roll cutaways untested until Plan 3.
- Ruling: Task 10 Step 6 (Eren's verdict) is collected by the controller; the implementer stops after Step 5 with renders + evidence.
- Ruling (user directive 2026-10-25): Task 10 cut to 9:16 only, standard qa + one contact sheet; per-cut click/containment/timing analyses and 4:5/1:1 deferred — user reviews by eye. Future work: cut controller-side verification the user can do themselves.
- Ruling: "Topic assets & animations" is an option card (Selection.topicAssets) so Claude-chosen logos/custom animations still respect "Claude uses only ticked cards"; ticked by default for talking-head — cost if wrong: one default flip.
- Ruling: ChatGPT/OpenAI logo must resolve offline (user's own example): add pinned npm alias simple-icons@13.0.0 as fallback for marks removed in v16 — cost if wrong: one extra dependency; trademark use is editorial, user's call per video.
- Follow-up TH: 36d1dcc ChatGPT→OpenAI via simple-icons-v13 fallback. Ruling: follow-up's separate task review folded into the final whole-branch review (user directive: save time) — cost if wrong: findings land in one fix wave instead of two.
- Ruling: CSP keeps inline scripts allowed (HyperFrames 0.8.191's own runtime scripts break under a sha256 pin) but no unsafe-eval, connect/object/base/form 'none'; the fragment allowlist forbids every on* attribute, so inline handlers can't enter — cost if wrong: a CSP-level gap only reachable if the allowlist fails.
- Ruling: list/checklist item `at` before card start stays allowed (carried-over list items), after card end rejected.
- Ruling: re-review found one real residual — '</script>' in a timeline string breaks out of the inline script (CSP allows inline) — security-sensitive and a one-line fix, so it gets a narrow extra fix dispatch despite the one-wave rule; also ban image-set/image/cross-fade and run checkUrls on timeline strings; cost if wrong: one more short round. Homoglyph/whitespace keys parked: inert in GSAP.

## Deferred minors (for later plans)

- Task 1: minor (deferred): two failing-path tests assert only ok===false (music / card-outside) — should assert error text
- Task 1: minor (deferred): no check that shots lie within their scene / punch within shot
- Task 1: minor (deferred): card params untyped (typed per template in Task 5/8)
- Task 2: minor (deferred): run.ts taskkill via spawnSync unchecked — if taskkill fails the promise can hang; fall back to child.kill; timeout path untested
- Task 2: minor (deferred): probe tags.rotate fallback has opposite sign convention; rational() NaN on malformed; unicode test cleanup not in finally
- Task 3: minor (deferred): full-range luma test doesn't discriminate (testsrc2 mid-grey); assert ymin/ymax instead
- Task 3: minor (deferred): finishLoudness single-pass loudnorm — real reels may miss ±1 LUFS / TP after AAC; Task 6 QA loudness gate is the net, consider two-pass
- Task 4: minor (deferred): python3 fallback only on ENOENT (Store python stub won't fall back); no timeout on transcribe run; prompt starting with '-' could misparse
- Task 5: minor (deferred): title-card in/out tweens overlap on cards < ~0.62 s
- Task 5: minor (deferred): logo-pop `bg` not validated as a colour (CSS injection incl. gradients) — validate hex
- Task 5: minor (deferred): fontsource CSS regex uses `!` assertions; Nunito emitted but unused; <html lang="tr"> hard-coded
- Task 5: minor (deferred): ToolIcon lacks per-tool object-position (Fooocus 25% 20%) — visible gap vs v5 in Spike A
- Task 5: minor (deferred): caption test matches unescaped word against escaped HTML
- Task 5: minor (deferred): lint warnings nested_structure_needs_subcomposition + duplicate_media_discovery_risk
- Task 6: minor (deferred): loudness check reads input_tp via loudnorm rather than ebur128; render doesn't assert output exists; crf ignored for mov silently
- Task 7: minor (deferred): PUNCH constants duplicated from compile/layers.ts; workDir intermediates not cleaned; negative punch−at unguarded
- Task 7: minor (deferred): -x264-params passed redundantly on ffv1 base encode; punch-test PSNR thresholds loose
- Task 8: minor (deferred): face_track drops no-face frames without interpolation; no test of cropCommands with from>0; short-card tween overlaps (cardInOut <0.7 s, typed-title past end, checklist/follow-outro times after card.end unvalidated); card content starts 0.1–0.2 s after card entry; renderTrimmedTake no audio-stream check; 30 ms of retake audio bleeds into the crossfade
- Task 8: minor (deferred): older reel cards + captions ignore split region (captions at 0.677H sit over the face card); layered path gets split region for cards but no face/layout layers
- Task 8: minor (deferred): snapSegments silently drops sub-half-frame segments; facePos not auto-populated (planner must call facePosition)
- Task 9: minor (deferred): finishLoudness comment claims retry on I but only retries on TP; punchEase injected via string replace on vars() output; GSAP punch holds 1.07992 vs ffmpeg 1.08; stray template literal in spike console.log
- Task 9: minor (deferred): luma gate measures base.mkv, so composite/x264 stage colour is ungated (use lumaRegion on composite); s10 punch ref margin thin (+2.54/3); Whisper-card list timing differs from v5; Upscayl/VoiceStudio tiles keep drop shadow v5 lacks
- Task 10: minor (deferred): captions white-on-beige in full-graphics beat barely readable; source's own cutaway shots appear in split face card; excerpt has no real stumble
- Task 10: minor (deferred): full suite 81/82 — face_track contract test times out (~122 s) under full-suite parallel load (passes alone in 15/15 run); raise its timeout / run serially. Fix in final-review wave.
- Follow-up TH: minor (deferred): spike working clip is already 9:16 so split card is narrow until re-prep with aspect 16/9; layered punch-in on non-frame-aspect shot mis-crops; fragment rules strict (no loops)
