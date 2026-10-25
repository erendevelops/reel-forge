// Mimics the `claude` CLI for tests. Behaviour comes from FAKE_CLAUDE_MODE.
// Output shapes copied from a real `claude -p --output-format stream-json --verbose` run.
const mode = process.env.FAKE_CLAUDE_MODE ?? 'ok';
const args = process.argv.slice(2);
const out = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);

if (args.includes('--version')) {
  if (mode === 'missing') process.exit(127);
  process.stdout.write('2.1.0 (Claude Code)\n');
  process.exit(0);
}

let stdin = '';
process.stdin.on('data', (c) => (stdin += c));
process.stdin.on('end', async () => {
  const sid = args.includes('--resume') ? args[args.indexOf('--resume') + 1] : 'sess-1234';
  out({ type: 'system', subtype: 'hook_started', session_id: sid });
  out({ type: 'system', subtype: 'init', session_id: sid, cwd: process.cwd(), tools: ['Bash'] });
  if (mode === 'logged-out') {
    const msg = 'Failed to authenticate: OAuth session expired and could not be refreshed';
    out({ type: 'assistant', message: { content: [{ type: 'text', text: msg }] } });
    out({ type: 'result', subtype: 'success', is_error: true, result: msg, session_id: sid });
    process.exit(1);
  }
  if (mode === 'limit') {
    const msg = "You've hit your session limit · resets 2pm (Europe/Istanbul)";
    out({ type: 'assistant', message: { content: [{ type: 'text', text: msg }] } });
    out({ type: 'result', subtype: 'success', is_error: true, result: msg, session_id: sid });
    process.exit(1);
  }
  if (mode === 'save') {
    // Like a real plan job: write plan.json and store it through rf (env from the job runner).
    const { copyFileSync } = await import('node:fs');
    const { spawnSync } = await import('node:child_process');
    const path = await import('node:path');
    const root = process.env.REELFORGE_ROOT;
    copyFileSync(path.join(root, 'tests/fixtures/plan-reel-v5.json'), 'plan.json');
    const r = spawnSync(process.execPath, [path.join(root, 'node_modules/tsx/dist/cli.mjs'), '--tsconfig', path.join(root, 'tsconfig.json'), path.join(root, 'scripts/rf.ts'), 'save', 'plan.json'], { encoding: 'utf8' });
    out({ type: 'assistant', message: { content: [{ type: 'text', text: `rf: ${r.stdout.trim()}` }] } });
    out({ type: 'result', subtype: 'success', is_error: r.status !== 0, result: r.stdout.trim(), session_id: sid });
    process.exit(r.status ?? 1);
  }
  if (mode === 'env') {
    const { readFileSync } = await import('node:fs');
    const sep = process.platform === 'win32' ? ';' : ':';
    out({ type: 'assistant', message: { content: [{ type: 'text', text: `path0: ${(process.env.PATH ?? process.env.Path ?? '').split(sep)[0]}` }] } });
    out({ type: 'assistant', message: { content: [{ type: 'text', text: `claudemd: ${readFileSync('CLAUDE.md', 'utf8')}` }] } });
    out({ type: 'result', subtype: 'success', is_error: false, result: 'ok', session_id: sid });
    process.exit(0);
  }
  if (mode === 'hang') {
    setInterval(() => {}, 1000);
    return;
  }
  out({ type: 'assistant', message: { content: [{ type: 'text', text: `argv: ${args.join(' ')}` }] } });
  out({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'ffprobe -v error inputs/clip.mov' } }] } });
  out({ type: 'user', message: { content: [{ type: 'tool_result', content: 'ok' }] } });
  out({ type: 'assistant', message: { content: [{ type: 'text', text: `prompt: ${stdin.trim()}` }] } });
  out({ type: 'result', subtype: 'success', is_error: false, result: 'done', session_id: sid, total_cost_usd: 0 });
});
