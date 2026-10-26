import type { Card, Plan } from '@/lib/plan/schema';

/**
 * Direct edits (spec §8): small, named changes the UI makes to a plan without Claude. Every one is checked here;
 * the saved version is validated again against the project's option cards.
 */
export type Edit =
  | { op: 'card-param'; scene: string; card: number; key: string; value: string | number }
  | { op: 'card-time'; scene: string; card: number; start: number; end: number }
  | { op: 'item-at'; scene: string; card: number; item: number; at: number }
  | { op: 'caption-word'; group: number; word: number; text: string }
  | { op: 'sfx'; index: number; at?: number; volume?: number }
  | { op: 'music'; mediaStart?: number; volume?: number }
  | { op: 'shot-in'; scene: string; shot: number; from: number }
  | { op: 'look'; key: keyof NonNullable<Plan['look']>; value: string | number };

export class EditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EditError';
  }
}

/** Params a hand edit may change: top-level strings and numbers, never a custom animation's code or an image path. */
const LOCKED = new Set(['html', 'css', 'script', 'timeline', 'img', 'logo']);

export function editableParams(card: Card): { key: string; kind: 'text' | 'number' }[] {
  return Object.entries(card.params)
    .filter(([k, v]) => !LOCKED.has(k) && (typeof v === 'string' || typeof v === 'number'))
    .map(([key, v]) => ({ key, kind: typeof v === 'number' ? 'number' : 'text' }));
}

const TOL = 1e-3;

/** The plan after `e`; the input is never mutated. */
export function applyEdit(plan: Plan, e: Edit): Plan {
  const p: Plan = structuredClone(plan);
  const scene = (id: string) => {
    const s = p.scenes.find((x) => x.id === id);
    if (!s) throw new EditError(`no scene ${id}`);
    return s;
  };
  const card = (id: string, i: number) => {
    const s = scene(id);
    const c = s.cards[i];
    if (!c) throw new EditError(`scene ${id} has no card ${i}`);
    return { s, c };
  };
  switch (e.op) {
    case 'card-param': {
      const { c } = card(e.scene, e.card);
      if (!editableParams(c).some((x) => x.key === e.key)) throw new EditError(`${c.type}.${e.key} can't be edited by hand`);
      if (typeof c.params[e.key] !== typeof e.value) throw new EditError(`${c.type}.${e.key} must stay a ${typeof c.params[e.key]}`);
      c.params[e.key] = e.value;
      break;
    }
    case 'card-time': {
      const { s, c } = card(e.scene, e.card);
      if (e.start < s.start - TOL || e.end > s.end + TOL || e.end <= e.start) throw new EditError(`card time ${e.start}–${e.end} must sit inside the scene ${s.start}–${s.end}`);
      c.start = e.start;
      c.end = e.end;
      break;
    }
    case 'item-at': {
      const { c } = card(e.scene, e.card);
      const items = (c.params as { items?: { at?: number }[] }).items;
      if (!Array.isArray(items) || !items[e.item]) throw new EditError(`${c.type} has no item ${e.item}`);
      if (e.at > c.end + TOL) throw new EditError(`item time ${e.at} is after the card ends (${c.end})`);
      items[e.item].at = e.at;
      break;
    }
    case 'caption-word': {
      const w = p.captions.groups[e.group]?.words[e.word];
      if (!w) throw new EditError(`no caption word ${e.group}/${e.word}`);
      if (!e.text.trim()) throw new EditError('a caption word cannot be empty');
      w[0] = e.text.trim();
      break;
    }
    case 'sfx': {
      const c = p.sfx[e.index];
      if (!c) throw new EditError(`no sound cue ${e.index}`);
      if (e.at !== undefined) {
        if (e.at < 0 || e.at > p.duration) throw new EditError(`sound time ${e.at} is outside the video`);
        c.at = e.at;
      }
      if (e.volume !== undefined) c.volume = Math.max(0, e.volume);
      break;
    }
    case 'music': {
      if (!p.music) throw new EditError('this plan has no music');
      if (e.mediaStart !== undefined) p.music.mediaStart = Math.max(0, e.mediaStart);
      if (e.volume !== undefined) p.music.volume = Math.max(0, e.volume);
      break;
    }
    case 'shot-in': {
      const s = scene(e.scene);
      const sh = s.shots[e.shot];
      if (!sh) throw new EditError(`scene ${e.scene} has no shot ${e.shot}`);
      if (e.from < 0) throw new EditError('an in-point cannot be negative');
      const len = sh.to - sh.from;
      sh.from = e.from;
      sh.to = Number((e.from + len).toFixed(6));
      break;
    }
    case 'look': {
      p.look = { ...(p.look ?? { background: '#F7F3EA' }), [e.key]: e.value };
      break;
    }
  }
  return p;
}

/** Leaf-level differences between two plans (arrays by index), e.g. `scenes[2].cards[0].params.to`. */
export function diffPlans(a: Plan, b: Plan): { path: string; from: unknown; to: unknown }[] {
  const out: { path: string; from: unknown; to: unknown }[] = [];
  const walk = (x: unknown, y: unknown, at: string) => {
    if (x === y) return;
    const objX = typeof x === 'object' && x !== null;
    const objY = typeof y === 'object' && y !== null;
    if (!objX || !objY || Array.isArray(x) !== Array.isArray(y)) {
      out.push({ path: at, from: x, to: y });
      return;
    }
    if (Array.isArray(x) && Array.isArray(y)) {
      for (let i = 0; i < Math.max(x.length, y.length); i++) walk(x[i], y[i], `${at}[${i}]`);
      return;
    }
    const keys = new Set([...Object.keys(x as object), ...Object.keys(y as object)]);
    for (const k of keys) walk((x as Record<string, unknown>)[k], (y as Record<string, unknown>)[k], at ? `${at}.${k}` : k);
  };
  walk(a, b, '');
  return out;
}
