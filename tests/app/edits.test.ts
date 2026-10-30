import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { EditError, applyEdit, diffPlans, editableParams } from '../../lib/app/edits';
import type { Card, Plan } from '../../lib/plan';

const v5 = (): Plan => JSON.parse(readFileSync('tests/fixtures/plan-reel-v5.json', 'utf8'));

describe('applyEdit', () => {
  it('changes a card param without touching the input plan', () => {
    const before = v5();
    const after = applyEdit(before, { op: 'card-param', scene: 'fooocus', card: 0, key: 'name', value: 'Fooocus AI' });
    expect(after.scenes[1].cards[0].params.name).toBe('Fooocus AI');
    expect(before.scenes[1].cards[0].params.name).toBe('Fooocus');
  });

  it('refuses card times outside the scene and unknown scenes', () => {
    expect(() => applyEdit(v5(), { op: 'card-time', scene: 'fooocus', card: 0, start: 6.2, end: 99 })).toThrow(EditError);
    expect(() => applyEdit(v5(), { op: 'card-param', scene: 'nope', card: 0, key: 'name', value: 'x' })).toThrow(EditError);
  });

  it('fixes a caption word and keeps its time', () => {
    const after = applyEdit(v5(), { op: 'caption-word', group: 0, word: 2, text: 'Yapay' });
    expect(after.captions.groups[0].words[2]).toEqual(['Yapay', 0.68]);
  });

  it('moves an SFX cue and changes its volume', () => {
    const after = applyEdit(v5(), { op: 'sfx', index: 0, at: 0.7, volume: 0.3 });
    expect(after.sfx[0]).toMatchObject({ at: 0.7, volume: 0.3 });
  });

  it('shifts a shot in-point keeping its duration and timeline place', () => {
    const after = applyEdit(v5(), { op: 'shot-in', scene: 'fooocus', shot: 0, from: 13 });
    expect(after.scenes[1].shots[0]).toMatchObject({ from: 13, to: 15.68, at: 6.16 });
    expect(() => applyEdit(v5(), { op: 'shot-in', scene: 'fooocus', shot: 0, from: -1 })).toThrow(EditError);
  });

  it('swaps a shot to a picked work clip, keeping its length and place', () => {
    const after = applyEdit(v5(), { op: 'shot-clip', scene: 'fooocus', shot: 0, src: 'work/pick-a1.mp4' });
    expect(after.scenes[1].shots[0]).toMatchObject({ src: 'work/pick-a1.mp4', from: 0, to: 2.68, at: 6.16 });
    expect(() => applyEdit(v5(), { op: 'shot-clip', scene: 'fooocus', shot: 0, src: 'inputs/a.MOV' })).toThrow(EditError);
    expect(() => applyEdit(v5(), { op: 'shot-clip', scene: 'fooocus', shot: 0, src: 'work/../x.mp4' })).toThrow(EditError);
  });

  it('sets a kit colour', () => {
    const after = applyEdit({ ...v5(), look: { background: '#000000' } }, { op: 'look', key: 'accent', value: '#F0585B' });
    expect(after.look?.accent).toBe('#F0585B');
  });

  it('never edits the code of a custom animation', () => {
    const card: Card = { type: 'custom-animation', start: 0, end: 2, params: { html: '<div></div>', css: '', script: 'x', label: 'chips', count: 3 } };
    expect(editableParams(card)).toEqual([{ key: 'label', kind: 'text' }, { key: 'count', kind: 'number' }]);
    const plan = v5();
    plan.scenes[0].cards[0] = card;
    expect(() => applyEdit(plan, { op: 'card-param', scene: 'hook', card: 0, key: 'script', value: 'y' })).toThrow(EditError);
  });
});

describe('diffPlans', () => {
  it('lists exactly the changed leaves', () => {
    const a = v5();
    const b = applyEdit(applyEdit(a, { op: 'card-param', scene: 'fooocus', card: 0, key: 'name', value: 'X' }), { op: 'sfx', index: 0, at: 0.7 });
    expect(diffPlans(a, b)).toEqual([
      { path: 'scenes[1].cards[0].params.name', from: 'Fooocus', to: 'X' },
      { path: 'sfx[0].at', from: 0.68, to: 0.7 },
    ]);
  });
});
