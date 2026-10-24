import { PlanSchema, type Plan } from './schema';

const TOL = 1e-3;

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

  // 1. selection
  const sel = plan.selection;
  for (const scene of plan.scenes) {
    scene.cards.forEach((card, ci) => {
      if (!sel.cards.includes(card.type)) {
        errors.push(`scene ${scene.id} card[${ci}]: card type ${card.type} not selected`);
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

  // 3. cards inside their scene
  for (const scene of scenes) {
    scene.cards.forEach((card, ci) => {
      if (card.start < scene.start - TOL || card.end > scene.end + TOL) {
        errors.push(
          `scene ${scene.id} card[${ci}] (${card.type}) ${card.start}-${card.end} is outside the scene ${scene.start}-${scene.end}`,
        );
      }
    });
  }

  // 4. last scene ends at duration
  const last = scenes[scenes.length - 1];
  if (Math.abs(last.end - plan.duration) > TOL) {
    errors.push(`last scene ${last.id} ends at ${last.end} but duration is ${plan.duration}`);
  }

  return errors.length ? { ok: false, errors } : { ok: true, plan };
}
