import { PlanSchema, type Card, type Plan } from './schema';
import { checkFragment } from './fragment';
import { CARD_PARAMS } from './card-params';
import { logoRef, resolveLogo } from '../assets/logos';
import { checkVariety } from './variety';

const TOL = 1e-3;

/** Logo references of a card: logo-pop `img`, title-card `logo`, numbered-list `items[].logo`. */
function logoRefs(card: Card): string[] {
  const p = card.params as Record<string, unknown>;
  const refs: unknown[] = [];
  if (card.type === 'logo-pop') refs.push(p.img);
  if (card.type === 'title-card') refs.push(p.logo);
  if (card.type === 'numbered-list' && Array.isArray(p.items)) for (const it of p.items) refs.push((it as Record<string, unknown>)?.logo);
  return refs.filter((r): r is string => typeof r === 'string');
}

export type ValidationResult = { ok: true; plan: Plan } | { ok: false; errors: string[] };

export function validatePlan(input: unknown): ValidationResult {
  const parsed = PlanSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    };
  }
  const plan = parsed.data;
  const errors: string[] = [];
  if (plan.mode === 'app' && !plan.look?.background) errors.push('app videos need look.background (the brand ground colour)');
  // U+FFFD means text was decoded with the wrong encoding somewhere (Windows' ANSI default for Turkish ı/ş/ğ).
  if (JSON.stringify(plan).includes('�')) {
    errors.push('text contains the replacement character "�" (broken encoding): re-read every file with encoding="utf-8" (Python: open(path, encoding="utf-8")), rebuild the text, and save again');
  }

  // 1. selection
  const sel = plan.selection;
  for (const scene of plan.scenes) {
    scene.cards.forEach((card, ci) => {
      const at = `scene ${scene.id} card[${ci}] (${card.type})`;
      if (!sel.cards.includes(card.type)) {
        errors.push(`scene ${scene.id} card[${ci}]: card type ${card.type} not selected`);
      }
      // topic assets (spec §6): Claude-authored animations and topic-resolved logos only when ticked
      if (card.type === 'custom-animation') {
        if (!sel.topicAssets) errors.push(`${at}: custom-animation requires selection.topicAssets`);
        for (const e of checkFragment(card.params, card.end - card.start)) errors.push(`${at}: ${e}`);
      }
      for (const ref of logoRefs(card)) {
        const slug = logoRef(ref);
        if (slug === undefined) continue;
        if (!sel.topicAssets) errors.push(`${at}: logo ${ref} is a topic asset and requires selection.topicAssets`);
        if (!resolveLogo(slug)) errors.push(`${at}: unknown logo ${ref} (not in the bundled simple-icons set)`);
      }
    });
    if (scene.layout && !sel.layouts.includes(scene.layout)) {
      errors.push(`scene ${scene.id}: layout ${scene.layout} not selected`);
    }
    if (!sel.punchIns && scene.shots.some((s) => s.punch !== undefined)) {
      errors.push(`scene ${scene.id}: punch-ins used but not selected`);
    }
  }
  if (plan.captions.style !== sel.captions) {
    errors.push(`captions: style ${plan.captions.style} does not match selected ${sel.captions}`);
  }
  if (plan.cover) {
    if (!sel.thumbnail) errors.push('cover: present but the cover option is not selected');
    if (plan.cover.at >= plan.duration) errors.push(`cover.at ${plan.cover.at} is not inside the video (0–${plan.duration})`);
    const slug = plan.cover.logo ? logoRef(plan.cover.logo) : undefined;
    if (slug !== undefined) {
      if (!sel.topicAssets) errors.push(`cover: logo ${plan.cover.logo} is a topic asset and requires selection.topicAssets`);
      if (!resolveLogo(slug)) errors.push(`cover: unknown logo ${plan.cover.logo} (not in the bundled simple-icons set)`);
    }
  }
  if (plan.music && !sel.music) errors.push('music: present but music is not selected');
  if (plan.sfx.length > 0 && !sel.sfx) errors.push('sfx: cues present but sfx is not selected');

  // 2. scene order, overlap, gaps
  const { scenes } = plan;
  if (Math.abs(scenes[0].start) > TOL) {
    errors.push(`scene ${scenes[0].id}: first scene must start at 0 (starts at ${scenes[0].start})`);
  }
  for (let i = 1; i < scenes.length; i++) {
    const prev = scenes[i - 1];
    const cur = scenes[i];
    const d = cur.start - prev.end;
    if (d < -TOL) errors.push(`scenes ${prev.id} and ${cur.id} overlap by ${(-d).toFixed(3)}s`);
    else if (d > TOL) errors.push(`gap of ${d.toFixed(3)}s between scenes ${prev.id} and ${cur.id}`);
  }

  // 3. cards inside their scene, params valid for their template, list/checklist items not after the card
  for (const scene of scenes) {
    scene.cards.forEach((card, ci) => {
      const at = `scene ${scene.id} card[${ci}] (${card.type})`;
      if (card.start < scene.start - TOL || card.end > scene.end + TOL) {
        errors.push(`${at} ${card.start}-${card.end} is outside the scene ${scene.start}-${scene.end}`);
      }
      // custom-animation params are reported by checkFragment above
      if (card.type !== 'custom-animation') {
        const p = CARD_PARAMS[card.type].safeParse(card.params);
        if (!p.success) for (const i of p.error.issues) errors.push(`${at}: params.${i.path.join('.')}: ${i.message}`);
      }
      // `at` before the card start = already landed/ticked (a carried-over list); after its end it would never show
      if (card.type === 'numbered-list' || card.type === 'checklist') {
        const items = (card.params as { items?: unknown }).items;
        if (Array.isArray(items)) {
          items.forEach((it, ii) => {
            const t = (it as { at?: unknown })?.at;
            if (typeof t === 'number' && t > card.end + TOL) errors.push(`${at}: items[${ii}].at ${t} is after the card ends (${card.end})`);
          });
        }
      }
    });
    // shots inside their scene; a punch-in must start while its shot is on screen
    scene.shots.forEach((sh, si) => {
      const end = sh.at + (sh.to - sh.from);
      if (sh.at < scene.start - TOL || end > scene.end + TOL) {
        errors.push(`scene ${scene.id} shot[${si}] ${sh.at}-${Number(end.toFixed(6))} is outside the scene ${scene.start}-${scene.end}`);
      }
      if (sh.punch !== undefined && (sh.punch < sh.at - TOL || sh.punch >= end - TOL)) {
        errors.push(`scene ${scene.id} shot[${si}]: punch ${sh.punch} is outside the shot [${sh.at}, ${Number(end.toFixed(6))})`);
      }
    });
  }

  // 4. last scene ends at duration
  const last = scenes[scenes.length - 1];
  if (Math.abs(last.end - plan.duration) > TOL) {
    errors.push(`last scene ${last.id} ends at ${last.end} but duration is ${plan.duration}`);
  }

  // 5. variety (talking-head and app videos)
  errors.push(...checkVariety(plan));

  return errors.length ? { ok: false, errors } : { ok: true, plan };
}
