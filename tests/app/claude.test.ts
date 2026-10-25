import { afterEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { parseStreamLine, type ClaudeEvent } from '../../lib/app/claude/events';
import { classifyFailure, runClaude } from '../../lib/app/claude/run';
import { checkAvailability } from '../../lib/app/claude/availability';

const FAKE = path.join(__dirname, '../fixtures/fake-claude.mjs');
// A "binary" that is node + the fake script; runClaude accepts a command prefix.
const binary = `${process.execPath}|${FAKE}`;

afterEach(() => {
  delete process.env.FAKE_CLAUDE_MODE;
});

async function collect(mode: string, extra: Partial<Parameters<typeof runClaude>[0]> = {}) {
  process.env.FAKE_CLAUDE_MODE = mode;
  const events: ClaudeEvent[] = [];
  const res = await runClaude({
    binary,
    cwd: os.tmpdir(),
    prompt: 'plan the reel',
    allowedTools: ['Bash', 'Read'],
    timeoutMs: 10_000,
    onEvent: (e) => events.push(e),
    ...extra,
  });
  return { res, events };
}

describe('parseStreamLine', () => {
  it('parses session, text, tool and result lines', () => {
    expect(parseStreamLine('{"type":"system","subtype":"init","session_id":"s1"}')).toEqual([{ kind: 'session', sessionId: 's1' }]);
    expect(parseStreamLine('{"type":"assistant","message":{"content":[{"type":"text","text":"hi"}]}}')).toEqual([{ kind: 'text', text: 'hi' }]);
    const tool = parseStreamLine('{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash","input":{"command":"ffprobe -v error clip.mov"}}]}}');
    expect(tool).toEqual([{ kind: 'tool', name: 'Bash', summary: 'Bash: ffprobe -v error clip.mov' }]);
    expect(parseStreamLine('{"type":"result","is_error":false,"result":"done"}')).toEqual([{ kind: 'result', ok: true, text: 'done' }]);
  });

  it('ignores malformed and unknown lines', () => {
    expect(parseStreamLine('not json')).toEqual([]);
    expect(parseStreamLine('{"type":"system","subtype":"hook_started"}')).toEqual([]);
    expect(parseStreamLine('')).toEqual([]);
  });
});

describe('runClaude', () => {
  it('streams events and returns sessionId', async () => {
    const { res, events } = await collect('ok');
    expect(res).toEqual({ sessionId: 'sess-1234', ok: true });
    expect(events.map((e) => e.kind)).toEqual(['session', 'text', 'tool', 'text', 'result']);
    expect(events.some((e) => e.kind === 'text' && e.text === 'prompt: plan the reel')).toBe(true);
    const argv = events.find((e) => e.kind === 'text') as { text: string };
    expect(argv.text).toContain('-p --output-format stream-json --verbose --permission-mode acceptEdits --allowedTools Bash,Read');
  });

  it('omits --allowedTools when the list is empty (an empty arg vanishes through cmd.exe)', async () => {
    const { events } = await collect('ok', { allowedTools: [] });
    const argv = (events.find((e) => e.kind === 'text') as { text: string }).text;
    expect(argv).not.toContain('--allowedTools');
  });

  it('passes --resume when resumeSession given', async () => {
    const { res, events } = await collect('ok', { resumeSession: 'sess-old' });
    expect(res.sessionId).toBe('sess-old');
    expect((events[1] as { text: string }).text).toContain('--resume sess-old');
  });

  it('reports a usage limit as an error event with reset time', async () => {
    const { res, events } = await collect('limit');
    expect(res.ok).toBe(false);
    expect(events.at(-1)).toEqual({ kind: 'error', code: 'limit', message: expect.stringContaining('session limit'), resetsAt: '2pm (Europe/Istanbul)' });
  });

  it('timeout kills the process', async () => {
    const started = Date.now();
    const { res, events } = await collect('hang', { timeoutMs: 500 });
    expect(res.ok).toBe(false);
    expect(events.at(-1)).toMatchObject({ kind: 'error', code: 'timeout' });
    expect(Date.now() - started).toBeLessThan(3000);
  });
});

describe('runClaude cancellation', () => {
  it('an already-aborted signal stops the run', async () => {
    const ac = new AbortController();
    ac.abort();
    const { res, events } = await collect('hang', { signal: ac.signal });
    expect(res.ok).toBe(false);
    expect(events.at(-1)).toMatchObject({ kind: 'error', message: 'cancelled' });
  });
});

describe('classifyFailure', () => {
  it('classifies rate limit with reset text', () => {
    expect(classifyFailure('', "You've hit your session limit · resets 2pm (Europe/Istanbul)")).toEqual({
      code: 'limit',
      message: "You've hit your session limit · resets 2pm (Europe/Istanbul)",
      resetsAt: '2pm (Europe/Istanbul)',
    });
  });

  it('classifies an expired OAuth session as auth', () => {
    expect(classifyFailure('', 'Failed to authenticate: OAuth session expired').code).toBe('auth');
  });
});

describe('checkAvailability', () => {
  it('availability classifies missing / logged-out / ok', async () => {
    expect((await checkAvailability(path.join(os.tmpdir(), 'no-such-claude-binary'), 'en')).status).toBe('missing');
    process.env.FAKE_CLAUDE_MODE = 'logged-out';
    const out = await checkAvailability(binary, 'en');
    expect(out.status).toBe('logged-out');
    expect(out.detail).toMatch(/not logged in/);
    process.env.FAKE_CLAUDE_MODE = 'ok';
    expect((await checkAvailability(binary, 'en')).status).toBe('ok');
  });
});
