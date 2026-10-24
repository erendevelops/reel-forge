import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validatePlan } from '../../lib/plan/index';

const load = (): any =>
  JSON.parse(readFileSync(new URL('../fixtures/plan-reel-v5.json', import.meta.url), 'utf8'));

describe('validatePlan', () => {
  it('parses reel v5 fixture', () => {
    const r = validatePlan(load());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.scenes).toHaveLength(7);
    expect(r.plan.scenes.reduce((n, s) => n + s.shots.length, 0)).toBe(12);
    expect(r.plan.fps).toBe(60);
    expect(r.plan.duration).toBe(32);
  });

  it('rejects unselected card', () => {
    const p = load();
    p.selection.cards = p.selection.cards.filter((c: string) => c !== 'title-card');
    const r = validatePlan(p);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]).toContain('title-card');
    expect(r.errors[0]).toContain('not selected');
  });

  it('rejects overlapping scenes', () => {
    const p = load();
    p.scenes[1].start = p.scenes[0].end - 0.5;
    const r = validatePlan(p);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.join('\n')).toContain('overlap');
  });

  it('rejects gaps', () => {
    const p = load();
    p.scenes[1].start = p.scenes[0].end + 0.5;
    const r = validatePlan(p);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.join('\n')).toContain('gap');
  });

  it('rejects music when not selected', () => {
    const p = load();
    p.selection.music = false;
    p.music = { src: 'music.mp3', mediaStart: 0, volume: 0.2, fadeOut: 1 };
    const r = validatePlan(p);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.join(', ')).toContain('music');
  });

  it('rejects card outside its scene', () => {
    const p = load();
    p.scenes[1].cards[0].start = p.scenes[1].start - 0.2;
    const r = validatePlan(p);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.join(', ')).toContain('outside');
  });

  it('reports schema errors as path: message', () => {
    const p = load();
    p.fps = 24;
    const r = validatePlan(p);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]).toMatch(/^fps: /);
  });
});
