# Plan 3 — rulings made during execution

Copied from the execution ledger before deleting the workspace.

- Task 1: Ruling: `rf beats` uses our own tools/beats.py (onset autocorrelation + phase fold + loudness-rise drop, the prao doc §7 method) instead of `hyperframes beats`, which only works on a whole composition folder — cost if wrong: a less robust tempo on complex music; swap later.
- Task 1: Ruling: rf runs as `tsx --tsconfig <repo>/tsconfig.json scripts/rf.ts` — tsx reads tsconfig (the @/ alias) from cwd, and rf's cwd is the project folder; Task 3 shims must pass --tsconfig — cost: none.
- Task 3: Ruling: new projects now get the preset default selection, so two Plan 2 tests asserting selection null were updated; prompt uses 'rf save plan.json --request' (rf needs the path) — cost: none.
- Task 3: Ruling: skills/ get frontmatter-only stubs here (Tasks 4–7 fill them) so installSkills has something to copy — cost: none.
- Task 3: Ruling: auto-draft is an executor `next` spec started after the finished job releases the project (avoids JobBusyError) — cost: none.
- Task 3: Ruling: installSkills takes (project, prefs, dir) and store.createProject calls it, avoiding a store↔install import cycle — cost: none.
- Task 4: Ruling: lint checks card coverage via '### `type`' headings in cards.md (exact set = CARD_TYPES) instead of scanning every backticked token (too many false positives) — cost: none.
- Final: Ruling: skills lint normalises CRLF so skills edited on Windows still parse — cost: none.
- Task 8: Ruling: PYTHONUTF8 can't reach Claude's 'python -I' helpers, so validatePlan now refuses U+FFFD with a how-to-fix message + rules.md UTF-8 rule; test 'rejects text with the U+FFFD replacement character…' RED→GREEN — cost if wrong: a plan quoting a literal � is refused.

## Fixed in the final review pass

- Final: fixed selection gate trusting plan.selection — rf validate/save use the project's selection; test "save enforces the project selection, not the plan's own copy" RED→GREEN
- Final: fixed revise from stale plan.json — rf project returns latest {n, plan}; test 'project returns the latest plan so revisions start from it' RED→GREEN (prompt text updated with the doc fixes)
- Final: fixed cross-process version race — saveVersion claims versions/vN with exclusive mkdir; test 'saveVersion skips a version number another process already claimed' RED→GREEN
- Final: fixed rf not on PATH in Git Bash + stale CLAUDE.md — job env prepends project dir to PATH, CLAUDE.md rewritten per claude job; test 'claude jobs see the project folder first on PATH and a fresh CLAUDE.md' RED→GREEN
- Final: fixed missing trimmed-take step — new `rf trimtake <take> <trims.json> <out> --transcript t.json` (renders kept segments, writes re-timed transcript); test 'trimtake renders the kept segments and re-times the transcript' RED→GREEN
- Final: fixed fragments can't show screenshots — <img src="relative.png"> allowed (no .., no URL, image extensions only), src rewritten via the compiler's asset resolver; tests in tests/plan/fragment-img.test.ts RED→GREEN; Plan 1 case 'img (no external media)' changed to an external-src rejection
- Final: fixed skill-text contradictions — downloads to inputs/ext/ (not assets/ext), own files in inputs/work|ext, revise starts from latest.plan (prompt + skill), talking-head uses rf trimtake + transcript-trimmed.json (trimmed time everywhere), app-video outro via <img> custom-animation + ratioOverrides for per-ratio fragments, strip xmlns, no :nth-child; lint checks 'asset downloads go under inputs/…', 'revisions start from the latest stored plan…', 'talking head builds the trimmed take…', 'app-video outro uses <img>…', prompt test latest.plan — all RED→GREEN. Suite 331/331.

## Found and fixed in acceptance (Task 8)

- Task 8: found + fixed in the acceptance run — Next dev gives each route its own module copy, so listJobs marked live jobs 'failed: server restarted' (Plan 2 deferred minor, re-graded Important); registry now on globalThis; test 'a second copy of the jobs module … sees running jobs' RED→GREEN
- Task 8: found + fixed — Turkish captions garbled (Claude's Python helpers used Windows ANSI default); job env PYTHONUTF8=1/PYTHONIOENCODING=utf-8, rf.cmd chcp 65001; test assertions 'pyutf8: 1' + shim chcp RED→GREEN. Known, not fixed: job-log tool summaries show 'Masa�st�' (cosmetic; real CLI stdout verified UTF-8 clean).
- Task 8: correction — faceless re-run v1 has 0 U+FFFD (PYTHONUTF8 fix worked); later garbled readouts were the controller's own console (Python printing UTF-8 to a cp1254 console), likely also the 'Masa�st�' job-log summaries. Revise v2 = same text. Gate kept as a safety net.
- Task 8: rejection rebuild (scene scripts, design kit, 248 SFX, variety rules, rf preview, wide face card): see [2026-10-25-plan-3-acceptance.md](2026-10-25-plan-3-acceptance.md).

## Deferred minors

- Final: minor (deferred): auto-draft startJob failure is silent + race with a user job; --parent not validated as an existing integer; skills say rf gaps "returns []" but it prints {gaps: []}; faceless prep hardcodes --ratio 9:16; look.ink unused by the compiler; resolveInProject rejects names starting with '..'; beats-<basename>.json can collide; a version saved before a limit stop gets no auto-draft
