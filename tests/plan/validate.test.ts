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
  it('requires a BCP-47 plan.lang', () => {
    const p = load();
    expect(validatePlan(p).ok).toBe(true);
    expect(p.lang).toBe('tr');
    delete p.lang;
    const r = validatePlan(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join('\n')).toMatch(/^lang: /m);
    for (const bad of ['Turkish', 'tr_TR', '']) {
      const q = load();
      q.lang = bad;
      expect(validatePlan(q).ok, bad).toBe(false);
    }
    for (const good of ['en', 'tr', 'en-US', 'pt-BR']) {
      const q = load();
      q.lang = good;
      expect(validatePlan(q).ok, good).toBe(true);
    }
  });

  const errs = (p: unknown): string => {
    const r = validatePlan(p);
    return r.ok ? '' : r.errors.join('\n');
  };

  it("runs each card template's params schema", () => {
    const p = load();
    p.scenes[1].cards[0].params = { name: 'Fooocus' }; // title-card without n
    expect(errs(p)).toMatch(/scene fooocus card\[0\] \(title-card\): params\.n: /);
    const q = load();
    q.scenes[0].cards[0].params.bg = 'red; background-image: url(x.png)';
    expect(errs(q)).toMatch(/scene hook card\[0\] \(logo-pop\): params\.bg: .*hex/);
    const r = load();
    r.scenes[1].cards[1].params.highlight = 'all';
    expect(errs(r)).toMatch(/\(numbered-list\): params\.highlight/);
  });

  it('rejects shots outside their scene', () => {
    const p = load();
    p.scenes[1].shots[1].to += 0.5; // runs 0.5 s into the next scene
    expect(errs(p)).toMatch(/scene fooocus shot\[1\].*outside the scene/);
    const q = load();
    q.scenes[1].shots[0].at = q.scenes[1].start - 0.2;
    expect(errs(q)).toMatch(/scene fooocus shot\[0\].*outside the scene/);
  });

  it('rejects a punch outside [at, at + duration)', () => {
    const p = load();
    const sh = p.scenes[0].shots[0];
    sh.punch = sh.at + (sh.to - sh.from); // exactly the shot end: never visible
    expect(errs(p)).toMatch(/scene hook shot\[0\]: punch .* outside the shot/);
    const q = load();
    q.scenes[0].shots[1].punch = q.scenes[0].shots[1].at - 0.1; // before its shot starts
    expect(errs(q)).toMatch(/punch .* outside the shot/);
  });

  it('rejects list/checklist items landing after their card ends', () => {
    const p = load();
    const list = p.scenes[1].cards[1];
    list.params.items[0].at = list.end + 0.5;
    expect(errs(p)).toMatch(/scene fooocus card\[1\] \(numbered-list\): items\[0\]\.at .* after the card ends/);
    // landing before the card start is the documented "already landed" state of a carried-over list
    expect(validatePlan(load()).ok).toBe(true);
  });
});

describe('mojibake gate', () => {
  it('rejects text with the U+FFFD replacement character and says how to fix it', async () => {
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const plan = JSON.parse(readFileSync(path.join(__dirname, '../fixtures/plan-reel-v5.json'), 'utf8'));
    plan.captions.groups[0].words[0][0] = 'bilgisayar\uFFFDn\uFFFDzda';
    const r = validatePlan(plan);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join('\n')).toMatch(/encoding="utf-8"/);
  });
});
