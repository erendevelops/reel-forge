# Plan 2 — rulings made during execution

Copied from the execution ledger before deleting the workspace.

- Task 4: Ruling: runClaude/checkAvailability accept binary "exe|script" (pipe-separated prefix, no shell) so tests drive a fake claude via node — real use passes the claude path — cost if wrong: none.
- Task 4: Ruling: checkAvailability takes a `lang` argument (plan signature omitted it) so hints come from i18n — cost: none.
- Task 5: Ruling: job executors are registered per kind (registerExecutor) so Task 6 adds `render` without editing the claude path; JobSpec carries an ExtraJobSpec placeholder until then — cost: none.
- Task 6: Ruling: profile wall times go in the ledger (smoke run in background) instead of the commit message, so the commit isn't blocked on a render — cost: none.
- Task 7: Ruling: checks are exported individually (checkNode/checkClaude/checkFaceModel/…) plus runChecks, so tests exercise each without running all eight; fix strings are install commands (language-neutral), status text comes from i18n — cost: none.
- Task 6: Ruling (after timing): encoder settings alone didn't speed draft (53 s draft-first vs 38 s final — capture dominates); draft now also caps fps at 30 (profilePlan), halving captured frames — final unchanged — cost if wrong: draft previews are 30 fps.
- Task 8: Ruling: bundled-file paths use a repo-root helper (lib/root.ts, REELFORGE_ROOT ?? cwd) instead of import.meta.url — Next bundles server code into .next/ so import.meta.url breaks; app, tests and scripts all run from the repo root — cost if wrong: set REELFORGE_ROOT when running from elsewhere.
- Task 8: Ruling: client components import narrow modules (lib/plan/schema, lib/app/workspace/schema) so no node: modules reach the browser bundle.
- Task 8: Ruling: vitest setupFiles tests/setup-ui.ts adds RTL cleanup between UI tests (no vitest globals).

## Fixed in the final review pass

- Final: fixed lib/app/workspace untracked (.gitignore 'workspace/' → '/workspace/') — verified git ls-files lists the 5 files; clean-checkout suite run at the end.
- Final: fixed LAN-reachable API → dev/start bind 127.0.0.1; claudeBinary rejects shell metacharacters (test-only fake via env REELFORGE_CLAUDE_BINARY) — tests 'rejects a claude binary containing shell metacharacters' + 'dev and start scripts bind to loopback only' RED→GREEN
- Final: fixed Setup never ok on Windows (empty --allowedTools) — test 'omits --allowedTools when the list is empty' RED→GREEN
- Final: fixed render cancel ignored — ambient AsyncLocalStorage signal (lib/media/cancel.ts) kills every run() child; tests 'kills the process when the ambient signal aborts', 'cancelling a render kills its processes' RED→GREEN
- Final: fixed pool releasing job on first failure — pool waits for every started ratio; test 'a failing ratio waits for the other ratios before the job fails' RED→GREEN
- Final: fixed unvalidated jobId path traversal — /^job-[a-z0-9-]+$/ in jobFile, subscribe, resume; test 'rejects job ids that could escape the jobs folder' RED→GREEN
- Final: fixed log-write error leaving project busy — per-append catch + finally clears running state; test 'a failing log write does not leave the project busy' RED→GREEN

## Deferred minors

- Final: minor (deferred): FACE_MODEL_PATH uses cwd while reframe uses repoPath; live/runningByProject maps reset on dev hot reload (keep on globalThis); classifyFailure prefers stderr and auth regex is broad ("author"); EventSource not reconnected; GET /api/setup spends a tiny prompt each load; resume uses latest project session and can resume a paused job twice; duplicate input basenames merge; startJob doesn't pre-check claude availability
