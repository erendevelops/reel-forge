import { describe, expect, it } from 'vitest';
import { buildPrompt } from '../../lib/app/claude/prompts';
import { defaultSelection } from '../../lib/app/claude/install';
import type { Project, VersionOrigin } from '../../lib/app/workspace/schema';

const project = (over: Partial<Project> = {}): Project => ({
  id: 'p-abc123', name: 'P', mode: 'reel', preset: 'talking-head', ratios: ['9:16'], lang: 'en',
  selection: defaultSelection('talking-head'), claudeSession: null, createdAt: '', updatedAt: '', ...over,
});
const prefs = { rules: [{ text: 'calm 2–4 s shots', addedAt: '', source: 'v2' }] };
const v = (n: number, by: 'claude' | 'user', diff: unknown = null): VersionOrigin => ({ n, by, parent: n > 1 ? n - 1 : null, request: null, diff, createdAt: '' });

describe('stage prompts', () => {
  it('plan prompt lists only ticked cards and the motion rule for talking head', () => {
    const sel = { ...defaultSelection('talking-head'), cards: ['checklist' as const, 'stamp' as const] };
    const p = buildPrompt('plan', { project: project({ selection: sel }), preferences: prefs, versions: [] });
    expect(p).toContain('checklist');
    expect(p).toContain('stamp');
    expect(p).not.toContain('rolling-number');
    expect(p).toMatch(/rf gaps/);
    expect(p).toMatch(/every 3 s|3 seconds/);
    expect(p).toContain('calm 2–4 s shots');
    expect(p).toContain('rf save plan.json --request "first cut"');
  });

  it('revise prompt carries parent and user diffs', () => {
    const p = buildPrompt('revise', {
      project: project(),
      preferences: prefs,
      versions: [v(1, 'claude'), v(2, 'user', { moved: 'caption 3' }), v(3, 'user', { trimmed: 's02' })],
      request: 'Fooocus part a bit longer',
    });
    expect(p).toContain('--parent 3');
    expect(p).toContain('Fooocus part a bit longer');
    expect(p).toContain('caption 3');
    expect(p).toContain('s02');
  });

  it('prompts end with the reply language', () => {
    for (const stage of ['analyse', 'plan', 'revise'] as const) {
      expect(buildPrompt(stage, { project: project({ lang: 'tr' }), preferences: prefs, versions: [v(1, 'claude')], request: 'x' }).trim()).toMatch(/Türkçe\.?$/);
    }
  });
});
