import { describe, expect, it } from 'vitest';
import { projectStage } from '../../lib/app/flow';
import { defaultSelection } from '../../lib/app/claude/install';
import { ProjectSchema, type Project, type VersionOrigin } from '../../lib/app/workspace/schema';

const project = (over: Partial<Project> = {}): Project =>
  ProjectSchema.parse({
    id: 'p-1', name: 'P', mode: 'reel', preset: 'talking-head', ratios: ['9:16'], lang: 'tr',
    selection: defaultSelection('talking-head'), claudeSession: null, createdAt: '', updatedAt: '', ...over,
  });
const v1: VersionOrigin = { n: 1, by: 'claude', parent: null, request: null, diff: null, createdAt: '' };
const s = (o: Partial<{ analysed: boolean; versions: VersionOrigin[]; rendered: boolean }> = {}) => ({ analysed: false, versions: [], rendered: false, ...o });
const confirmed = (over: Partial<Project> = {}) => project({ cardsConfirmed: true, ...over });

describe('projectStage', () => {
  it('old project.json files without the new fields still parse', () => {
    const p = project();
    expect(p).toMatchObject({ cardsConfirmed: false, transcriptChecked: false, music: null });
  });

  it('walks cards → analyse → transcript → music → plan → storyboard → review', () => {
    expect(projectStage(project(), s())).toBe('cards');
    expect(projectStage(confirmed(), s())).toBe('analyse');
    expect(projectStage(confirmed(), s({ analysed: true }))).toBe('transcript');
    const music = { ...defaultSelection('talking-head'), music: true };
    expect(projectStage(confirmed({ transcriptChecked: true, selection: music }), s({ analysed: true }))).toBe('music');
    const picked = { title: 't', url: null, license: 'user upload', file: 'a.mp3' };
    expect(projectStage(confirmed({ transcriptChecked: true, selection: music, music: picked }), s({ analysed: true }))).toBe('plan');
    expect(projectStage(confirmed({ transcriptChecked: true }), s({ analysed: true }))).toBe('plan');
    expect(projectStage(confirmed({ transcriptChecked: true }), s({ analysed: true, versions: [v1] }))).toBe('storyboard');
    expect(projectStage(confirmed({ transcriptChecked: true }), s({ analysed: true, versions: [v1], rendered: true }))).toBe('review');
  });

  it('a reel whose analysis wrote no transcript does not get stuck on the transcript check', () => {
    expect(projectStage(confirmed(), { ...s({ analysed: true }), hasTranscript: false })).toBe('plan');
  });

  it('app videos skip the transcript check', () => {
    const app = confirmed({ mode: 'app', preset: 'app-video', selection: { ...defaultSelection('app-video'), music: false } });
    expect(projectStage(app, s({ analysed: true }))).toBe('plan');
  });

  it('a faceless reel without music goes transcript → plan', () => {
    const f = confirmed({ preset: 'faceless', selection: defaultSelection('faceless') });
    expect(projectStage(f, s({ analysed: true }))).toBe('transcript');
    expect(projectStage({ ...f, transcriptChecked: true }, s({ analysed: true }))).toBe('plan');
  });

  it('a project with versions is on the storyboard even if earlier flags are unset (made before Plan 4)', () => {
    expect(projectStage(project(), s({ versions: [v1] }))).toBe('storyboard');
  });
});
