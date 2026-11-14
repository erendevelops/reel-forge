import { describe, expect, it } from 'vitest';
import { buildPrompt } from '../../lib/app/claude/prompts';
import { defaultSelection } from '../../lib/app/claude/install';
import type { Project, VersionOrigin } from '../../lib/app/workspace/schema';

const project = (over: Partial<Project> = {}): Project => ({
  id: 'p-abc123', name: 'P', mode: 'reel', preset: 'talking-head', ratios: ['9:16'], lang: 'en',
  selection: defaultSelection('talking-head'), claudeSession: null, cardsConfirmed: true, transcriptChecked: false, music: null, references: [], brief: '', createdAt: '', updatedAt: '', ...over,
});
const prefs = { rules: [{ text: 'calm 2–4 s shots', addedAt: '', source: 'v2' }] };
const v = (n: number, by: 'claude' | 'user', diff: unknown = null): VersionOrigin => ({ n, by, parent: n > 1 ? n - 1 : null, request: null, diff, createdAt: '' });

describe('stage prompts', () => {
  it('plan prompt says the user checked the transcript and names the picked music file', () => {
    const music = { title: 'Ambient Minimal', url: null, license: 'Pixabay licence', file: 'ambient.mp3' };
    const p = buildPrompt('plan', { project: project({ transcriptChecked: true, music, selection: { ...defaultSelection('talking-head'), music: true } }), preferences: prefs, versions: [] });
    expect(p).toContain('The user corrected the transcript');
    expect(p).toContain('inputs/music/ambient.mp3');
    expect(p).toContain('Ambient Minimal');
    const q = buildPrompt('plan', { project: project(), preferences: prefs, versions: [] });
    expect(q).not.toContain('The user corrected the transcript');
  });

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

  it('plan and rebuild ask for web pictures only when a card can show them', () => {
    const p = buildPrompt('plan', { project: project(), preferences: prefs, versions: [] });
    expect(p).toContain('rf fetch');
    expect(buildPrompt('rebuild', { project: project(), preferences: prefs, versions: [v(1, 'claude')], chat: [{ role: 'user', text: 'x' }] })).toContain('rf fetch');
    const none = { ...defaultSelection('talking-head'), cards: ['checklist' as const] };
    expect(buildPrompt('plan', { project: project({ selection: none }), preferences: prefs, versions: [] })).not.toContain('rf fetch');
  });

  it('revise prompt carries parent and user diffs', () => {
    const p = buildPrompt('revise', {
      project: project(),
      preferences: prefs,
      versions: [v(1, 'claude'), v(2, 'user', { moved: 'caption 3' }), v(3, 'user', { trimmed: 's02' })],
      request: 'Fooocus part a bit longer',
    });
    expect(p).toContain('--parent 3');
    expect(p).toContain('latest.plan');
    expect(p).toMatch(/latest.plan/);
    expect(p).toContain('Fooocus part a bit longer');
    expect(p).toContain('caption 3');
    expect(p).toContain('s02');
  });

  it("puts the user's clip direction in every stage before Claude cuts anything", () => {
    const brief = 'Open with 0:12–0:18 of the second video; skip the third.';
    for (const stage of ['analyse', 'plan', 'rebuild', 'revise'] as const) {
      expect(buildPrompt(stage, { project: project({ brief }), preferences: prefs, versions: [v(1, 'claude')], request: 'x', chat: [] }), stage).toContain(brief);
    }
    expect(buildPrompt('plan', { project: project(), preferences: prefs, versions: [] })).not.toContain("user's direction");
  });

  it('gives each project its own motion flavour (stable across its versions) and asks for a small, consistent sound palette', () => {
    const line = (id: string, n: number) => buildPrompt('plan', { project: project({ id }), preferences: prefs, versions: Array.from({ length: n }, (_, i) => v(i + 1, 'claude')) });
    const flavour = (s: string) => /\(custom-animation\): (\w[\w -]*):/.exec(s)?.[1];
    const flavours = new Set(['a-1', 'b-2', 'c-3', 'd-4', 'e-5', 'f-6'].map((id) => flavour(line(id, 0))));
    expect(flavours.size).toBeGreaterThan(1);
    expect(flavour(line('a-1', 0))).toBe(flavour(line('a-1', 3)));
    expect(line('a-1', 0)).toMatch(/same gesture the same sound/);
    expect(line('a-1', 0)).not.toMatch(/rotate files/);
  });

  it('prompts end with the reply language', () => {
    for (const stage of ['analyse', 'plan', 'revise'] as const) {
      expect(buildPrompt(stage, { project: project({ lang: 'tr' }), preferences: prefs, versions: [v(1, 'claude')], request: 'x' }).trim()).toMatch(/Türkçe\.?$/);
    }
  });
});
