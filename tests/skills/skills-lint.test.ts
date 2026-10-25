import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { COMMANDS } from '../../lib/rf/commands';
import { CARD_TYPES, checkFragment, validatePlan } from '../../lib/plan';

const SKILLS = path.join(__dirname, '../../skills');
const skills = readdirSync(SKILLS).filter((d) => statSync(path.join(SKILLS, d)).isDirectory());

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.md') ? [p] : [];
  });
}
const text = (skill: string) => files(path.join(SKILLS, skill)).map((f) => readFileSync(f, 'utf8')).join('\n');
const blocks = (md: string, tag: string) => [...md.matchAll(new RegExp('```' + tag + '\\n([\\s\\S]*?)```', 'g'))].map((m) => m[1]);

describe('skills lint', () => {
  it('has the four skills', () => {
    expect(skills.sort()).toEqual(['app-video', 'reel-faceless', 'reel-talking-head', 'video-core']);
  });

  for (const skill of skills) {
    describe(skill, () => {
      const skillMd = readFileSync(path.join(SKILLS, skill, 'SKILL.md'), 'utf8');

      it('frontmatter has name = folder and a short description', () => {
        const fm = /^---\n([\s\S]*?)\n---/.exec(skillMd)?.[1] ?? '';
        expect(/^name: (.+)$/m.exec(fm)?.[1]).toBe(skill);
        const desc = /^description: (.+)$/m.exec(fm)?.[1] ?? '';
        expect(desc.length).toBeGreaterThan(0);
        expect(desc.length).toBeLessThanOrEqual(500);
      });

      it('is a real skill, not a stub', () => {
        expect(skillMd).not.toContain('Filled in by Plan 3');
        expect(text(skill).length).toBeGreaterThan(1500);
      });

      it('every relative link resolves', () => {
        for (const f of files(path.join(SKILLS, skill))) {
          for (const m of readFileSync(f, 'utf8').matchAll(/\]\(((?!https?:|#)[^)\s]+)\)/g)) {
            expect(existsSync(path.resolve(path.dirname(f), m[1].split('#')[0])), `${path.relative(SKILLS, f)} → ${m[1]}`).toBe(true);
          }
        }
      });

      it('every rf command it mentions exists', () => {
        for (const m of text(skill).matchAll(/`rf ([a-z-]+)/g)) {
          expect(Object.keys(COMMANDS), `rf ${m[1]}`).toContain(m[1]);
        }
      });

      it('plan-json examples validate', () => {
        for (const b of blocks(text(skill), 'plan-json')) {
          const r = validatePlan(JSON.parse(b));
          expect(r.ok, r.ok ? '' : r.errors.join('\n')).toBe(true);
        }
      });

      it('fragment-json examples pass the fragment rules', () => {
        for (const b of blocks(text(skill), 'fragment-json')) {
          const { duration, ...params } = JSON.parse(b);
          expect(checkFragment(params, duration ?? 3)).toEqual([]);
        }
      });
    });
  }

  it('video-core documents every card type with a heading in cards.md', () => {
    const cards = readFileSync(path.join(SKILLS, 'video-core/references/cards.md'), 'utf8');
    const headings = [...cards.matchAll(/^### `([a-z-]+)`/gm)].map((m) => m[1]);
    expect(headings.sort()).toEqual([...CARD_TYPES].sort());
  });

  it('reel-faceless mentions the transcript-review step and the 2–4 s shot rule', () => {
    const t = text('reel-faceless');
    expect(t).toContain('analysis/transcript-review.json');
    expect(t).toMatch(/2–4 s/);
  });

  it('talking-head skill requires rf gaps before save and forbids face zoom', () => {
    const t = text('reel-talking-head');
    expect(t).toMatch(/`rf gaps[^`]*`[^\n]*\[\][^\n]*rf save|rf gaps.*before.*rf save/is);
    expect(t).toMatch(/never (zoom|crop tighter)/i);
    expect(t).toContain('analysis/topics.json');
  });

  it('app-video skill rebuilds UI as custom-animation and forbids panning screenshots outside the outro', () => {
    const t = text('app-video');
    expect(t).toContain('custom-animation');
    expect(t).toMatch(/never pan|not pan|no panning/i);
    expect(t).toMatch(/outro/);
    expect(t).toContain('look.background');
    expect(t).toContain('analysis/product.json');
  });

  it('video-core has at least one fragment example and one plan example', () => {
    expect(blocks(text('video-core'), 'fragment-json').length).toBeGreaterThanOrEqual(2);
    expect(blocks(text('video-core'), 'plan-json').length).toBeGreaterThanOrEqual(1);
  });
});
