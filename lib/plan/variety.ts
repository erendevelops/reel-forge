import type { Card, Plan } from './schema';

/**
 * Variety rules (spec §6 "Unique, not repetitive"): creators rejected drafts where the same logo, card, animation and
 * sound kept coming back. Graphics carry new information and every beat looks and sounds different.
 * - sounds are the opposite: a palette of at most 5 files, the same sound for the same gesture, no two cues within
 *   0.15 s (every format);
 * - a stamp appears once per video (every format: a second slam is a gimmick);
 * - a topic logo appears once per video;
 * - a built-in card template is never used in two scenes in a row, nor more than twice per video;
 * - no two custom-animation cards are the same scene;
 * - a typed-title / stamp never restates the spoken line (captions already show it).
 * Faceless B-roll reels (every scene `broll`) are exempt: their running list and title cards carry over by design
 * (an accepted faceless format).
 */
export const MAX_SOUNDS = 5;

export function checkVariety(plan: Plan): string[] {
  const errors: string[] = [];
  const stamps = plan.scenes.filter((s) => s.cards.some((c) => c.type === 'stamp')).map((s) => s.id);
  const stampCount = plan.scenes.reduce((n, s) => n + s.cards.filter((c) => c.type === 'stamp').length, 0);
  if (stampCount > 1) errors.push(`stamp is used ${stampCount} times (scenes ${stamps.join(', ')}); a stamp appears once per video, keep the strongest one`);
  // sounds (every format): a small, consistent palette; rotating files made videos sound random and goofy
  const cues = [...plan.sfx].sort((a, b) => a.at - b.at);
  const files = new Set(cues.map((c) => c.file));
  if (files.size > MAX_SOUNDS) errors.push(`sfx: ${files.size} different sound files; use a palette of at most ${MAX_SOUNDS} and give the same gesture the same sound (video-core sfx.md)`);
  cues.forEach((c, i) => {
    if (i > 0 && c.at - cues[i - 1].at < 0.15) errors.push(`sfx: two cues at ${cues[i - 1].at}s and ${c.at}s; keep the one that matters`);
  });
  if (plan.scenes.every((s) => s.layout === 'broll')) return errors;

  // logos
  const logos = new Map<string, string[]>();
  for (const s of plan.scenes) for (const ref of new Set(s.cards.flatMap(logoRefs))) logos.set(ref, [...(logos.get(ref) ?? []), s.id]);
  for (const [ref, scenes] of logos) if (scenes.length > 1) errors.push(`logo ${ref} appears ${scenes.length} times (scenes ${scenes.join(', ')}); show a logo once, then build on it`);

  // templates
  const perType = new Map<string, string[]>();
  plan.scenes.forEach((s, i) => {
    const types = new Set(s.cards.map((c) => c.type).filter((t) => t !== 'custom-animation'));
    for (const t of types) {
      perType.set(t, [...(perType.get(t) ?? []), s.id]);
      if (i > 0 && plan.scenes[i - 1].cards.some((c) => c.type === t)) errors.push(`scenes ${plan.scenes[i - 1].id} and ${s.id} both use a ${t}; vary the graphics from beat to beat`);
    }
  });
  for (const [t, scenes] of perType) if (scenes.length > 2) errors.push(`${t} is used in ${scenes.length} scenes (${scenes.join(', ')}); at most 2 per video`);

  // custom scenes
  const seen = new Map<string, string>();
  for (const s of plan.scenes) for (const c of s.cards) {
    if (c.type !== 'custom-animation') continue;
    const p = c.params as Record<string, unknown>;
    const key = `${String(p.html ?? '').replace(/\s+/g, ' ')}|${String(p.script ?? '').replace(/\s+/g, ' ')}|${String(p.timeline ?? '').replace(/\s+/g, ' ')}`;
    if (seen.has(key)) errors.push(`scene ${s.id}: this custom-animation repeats the one in scene ${seen.get(key)}; build a different scene`);
    else seen.set(key, s.id);
  }

  // restating the spoken line
  for (const s of plan.scenes) for (const c of s.cards) {
    if (c.type !== 'typed-title' && c.type !== 'stamp') continue;
    const text = String((c.params as { text?: unknown }).text ?? '');
    if (restates(text, s.say)) errors.push(`scene ${s.id} ${c.type} "${text}" restates the spoken line; captions already show it, show new information (a number, a list, a comparison, an object) instead`);
  }
  return errors;
}

const words = (s: string) => s.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);

/** Three or more words, all of them spoken in the scene, in order. */
function restates(text: string, say: string): boolean {
  const t = words(text);
  if (t.length < 3) return false;
  const s = words(say);
  let k = 0;
  for (const w of s) if (w === t[k]) k++;
  return k === t.length;
}

function logoRefs(card: Card): string[] {
  const p = card.params as Record<string, unknown>;
  const refs: unknown[] = [];
  if (card.type === 'logo-pop') refs.push(p.img);
  if (card.type === 'title-card') refs.push(p.logo);
  if (card.type === 'numbered-list' && Array.isArray(p.items)) for (const it of p.items) refs.push((it as Record<string, unknown>)?.logo);
  return refs.filter((r): r is string => typeof r === 'string');
}
