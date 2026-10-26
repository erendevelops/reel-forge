import { t, type Language } from '@/lib/i18n';
import type { Stage } from '@/lib/app/flow';

const STEPS = ['footage', 'transcript', 'storyboard', 'render', 'review'] as const;
type Step = (typeof STEPS)[number];

const STEP_OF: Record<Stage, Step> = {
  cards: 'footage', analyse: 'footage', transcript: 'transcript', music: 'transcript', plan: 'storyboard', storyboard: 'storyboard', review: 'review',
};

/** Footage › Transcript › Storyboard › Render › Review (spec §11). `rendering`: a final render is running. */
export function StageBar({ lang, stage, rendering = false }: { lang: Language; stage: Stage; rendering?: boolean }) {
  const d = t(lang).stages;
  const current = STEPS.indexOf(rendering ? 'render' : STEP_OF[stage]);
  return (
    <ol className="stagebar font-mono">
      {STEPS.map((s, i) => (
        <li key={s} aria-current={i === current ? 'step' : undefined} className={i < current ? 'done' : i === current ? 'now' : ''}>
          {i < current ? '✓ ' : ''}
          <span>{d[s]}</span>
        </li>
      ))}
    </ol>
  );
}
