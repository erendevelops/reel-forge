import type { Plan } from './schema';

/** Longest a speech stretch may hold without a visual event (spec §6 "Motion density"). */
export const MOTION_MAX_STATIC = 3;

const r3 = (x: number) => Number(x.toFixed(3));

/** Visual events of a plan, in timeline seconds: card starts, list landings/ticks, layout changes. */
export function visualEvents(plan: Plan): number[] {
  const ev: number[] = [];
  let prev: string | undefined;
  for (const s of plan.scenes) {
    const layout = s.layout ?? 'full-face';
    if (prev !== undefined && layout !== prev) ev.push(s.start);
    prev = layout;
    for (const c of s.cards) {
      ev.push(c.start); // includes custom-animation starts
      const beats = (c.params as { beats?: unknown }).beats;
      if (c.type === 'custom-animation' && Array.isArray(beats)) {
        for (const b of beats) if (typeof b === 'number' && c.start + b <= c.end) ev.push(c.start + b);
      }
      const items = (c.params as { items?: unknown }).items;
      if ((c.type === 'numbered-list' || c.type === 'checklist') && Array.isArray(items)) {
        for (const it of items) {
          const at = (it as { at?: unknown }).at;
          if (typeof at === 'number' && at >= c.start && at <= c.end) ev.push(at);
        }
      }
    }
  }
  return [...new Set(ev.map(r3))].sort((a, b) => a - b);
}

/**
 * Speech stretches longer than `max` seconds (default 3) with no visual event — a card start, a list landing or
 * tick (`at`), a layout change or a custom-animation start. Speech is every scene with a non-empty `say`; silent
 * scenes never count. For planners and QA to flag static holds; the plan is not changed.
 */
export function motionGaps(plan: Plan, o: { max?: number } = {}): { from: number; to: number }[] {
  const max = o.max ?? MOTION_MAX_STATIC;
  const speech: [number, number][] = [];
  for (const s of plan.scenes) {
    if (!s.say.trim()) continue;
    const last = speech[speech.length - 1];
    if (last && s.start <= last[1] + 1e-3) last[1] = Math.max(last[1], s.end);
    else speech.push([s.start, s.end]);
  }
  const pts = [...new Set([0, ...visualEvents(plan), plan.duration])].sort((a, b) => a - b);
  const gaps: { from: number; to: number }[] = [];
  for (let i = 1; i < pts.length; i++) {
    for (const [a, b] of speech) {
      const from = Math.max(a, pts[i - 1]);
      const to = Math.min(b, pts[i]);
      if (to - from > max + 1e-9) gaps.push({ from: r3(from), to: r3(to) });
    }
  }
  return gaps;
}
