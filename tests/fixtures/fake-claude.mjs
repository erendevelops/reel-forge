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
process.stdin.on('end', () => {
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
