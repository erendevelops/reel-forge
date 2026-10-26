# Plan 4 — rulings made during execution

Copied from the execution ledger before deleting the workspace.

- Task 1: Ruling: postJob takes a third `lang` argument (plan: postJob(url, body)) — the busy text is localised and a plain helper has no context to read the language from — cost: none.
- Task 1: Ruling: a project with versions is always storyboard/review even when the new flags are false — projects made before Plan 4 (all acceptance projects) must not fall back to the cards screen — cost: none.
- Task 3: Ruling: the UI test asserts the computed count of ticked default tiles (15 for talking head) instead of the mockup's "7 seçili" — the catalogue has more tiles than the mockup — cost: none.
- Task 3: Ruling: OptionCards takes ratios/references props and a confirmLabel; CardsClient receives the default selection from the server page (install.ts pulls node:fs into the client bundle) — cost: none.
- Task 3: Ruling: confirm after versions exist saves only (200, jobId null), as the plan's "changing cards later only saves them" — cost: none.
- Task 4: Ruling: projectStage takes optional hasTranscript; a reel whose analysis wrote no transcript skips the check instead of being stuck — test 'a reel whose analysis wrote no transcript…' RED→GREEN — cost if wrong: an unchecked transcript goes to planning.
- Task 5: Ruling: added components/use-job.ts (live job events + running flag) for the music 'suggest others' job; later screens reuse it — cost: none.
- Task 6: Ruling: PreviewPlayer takes lang + duration props (play/pause label, scrubber max) beyond the plan's prop list — cost: none.
- Task 6: Ruling: the player also hides/shows every non-media `.clip` element by its time range (HyperFrames' runtime does this in renders; without it all cards would show at once) — tested in PLAYER_JS test — cost: none.
- Task 7: Ruling: editableParams also locks 'logo' (an image path like 'img'); card-param refuses changing a value's type (text stays text) — cost: none.
- Task 8: Ruling: GET /versions/[n] also returns thumbs (thumbnail-*.jpg URLs) for the Review posters — cost: none.
- Task 9: Ruling: consecutive edits of the same field collapse into one (typing a name = 1 edit; sfx at/volume merge) — otherwise "Kaydet (n)" counts keystrokes — cost: undo removes the whole field edit.
- Task 9: Ruling: AskClaude sends on Enter via onKeyDown (jsdom has no implicit form submit without a button) — cost: none.
- Task 9: Ruling: Approve & render is disabled while unsaved edits exist (it renders the saved version n) — cost: one extra click to save first.
- Task 10: Ruling: the QA fix request quotes each failed check's name + detail ("loudness I=-16.2 LUFS (target -14 ±1)…") — QaReport has no separate measured/limit fields — cost: none.
- Task 10: Ruling: the project page takes ?view=storyboard|review once versions exist (review is otherwise only reachable after a final render, the storyboard only before) — cost: none.
- Task 11: Ruling: useJob also returns the job's proposed preference; Storyboard and Review show PreferenceOffer until saved/dismissed — cost: none.

## Final review (opus): fixed

- Final: fixed preview frame running scene scripts with the app origin — sandbox="allow-scripts" + CSP sandbox header on preview HTML + guard exception for preview-file GETs + ACAO null for fonts; tests 'runs the preview in a sandboxed frame…', 'serves preview pages with a sandbox CSP…', 'lets the sandboxed preview frame load its own files… but nothing else' RED→GREEN; verified in headless Chrome: frame renders (gsap, timeline, fonts) and window.parent access → SecurityError. Suite 412/412.
- Final: fixed Claude job wiping unsaved edits — incoming version offered ("vN hazır… Aç"); test 'a version Claude saves while edits are pending does not wipe them…' RED→GREEN, suite 412/412
- Final: fixed scene click not moving the preview — PreviewPlayer `seek` prop; test 'seeks the frame when the parent asks (a scene click)' RED→GREEN, suite 412/412
- Final: fixed preview build races — per-plan folders `<tag>-<key>` (prune to 4, media hard-linked from the newest build) + client ignores out-of-date responses; tests 'builds different plans into different folders…', 'a new build reuses the media files…', 'only the newest preview build is shown…' RED→GREEN, suite 412/412
- Final: fixed number fields refusing intermediate keystrokes — NumberField draft commits on blur/Enter; test 'a typed number commits on blur…' RED→GREEN, suite 412/412
- Final: Ruling: the in-app browser pane blocks every sub-resource of a sandboxed (opaque-origin) frame with ERR_BLOCKED_BY_CLIENT, so the preview stays black there; real Chrome renders it — verified with headless Chrome — cost if wrong: previews in the Claude app's own browser pane are blank (users use their normal browser).

## Also found and fixed

- Task 1: note: tests/app/jobs.test.ts 'limit ends job paused-limit' is timing-flaky under the parallel suite (passes alone, before and after this change).
- Task 6: verified in the real app: the accepted talking-head v3 plan previews at t=5 s like its draft frame.
- Task 9: verified in the real app: acceptance-faceless-2 storyboard (scene lines, bold names, icons, live preview).
- Task 10: verified in the real app: acceptance-talking-head review (draft render, v2/v3 compare).
- Task 11: found + fixed (Plan 3 regression, e69a973): variety rule counted a logo shared by a title card and its list row in one scene twice — test 'a logo shown by two cards in the same scene… counts once' RED→GREEN; tests/assets/logos.test.ts green again.

## Deferred minors

- Final: minor (deferred): confirm route sets cardsConfirmed before startJob, so a 409 skips the cards stage without an analyse job
- Final: minor (deferred): ReviewClient stores a failed /versions fetch as a view (no r.ok check) and can throw
- Final: minor (deferred): Review compare pair is set once and doesn't follow `current` after a revise
- Final: minor (deferred): Storyboard jobId only from lastJobId; the auto-draft render isn't shown as running (Approve gets the busy message)
- Final: minor (deferred): each preview rebuild reloads the iframe paused while the parent's playing flag stays true
- Final: minor (deferred): music upload without content-length is read fully before the 50 MB check; type is checked by extension only
- Final: minor (deferred): files route serves any type under versions/ (an HTML file there would run same-origin if opened directly)
