'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { OptionCards, type CardsChoice } from '@/components/OptionCards';
import { postJob } from '@/components/post-job';
import { t, type Language } from '@/lib/i18n';
import type { Project } from '@/lib/app/workspace/schema';
import type { Selection } from '@/lib/plan/schema';

/** The cards stage: confirming stores the choice and starts the analysis (or, after the first plan, only saves). */
export function CardsClient({ lang, project, selection, after }: { lang: Language; project: Project; selection: Selection; after?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function confirm(c: CardsChoice) {
    setError(null);
    const out = await postJob(`/api/projects/${project.id}/confirm`, c, lang);
    if ('error' in out) return setError(out.error);
    if (after) router.push(after);
    router.refresh();
  }
  return (
    <>
      <OptionCards
        lang={lang}
        preset={project.preset}
        selection={selection}
        ratios={project.ratios}
        references={project.references}
        onConfirm={confirm}
        confirmLabel={after ? t(lang).cards.save : undefined}
        showRatios={!!after}
      />
      {error && <p className="font-mono text-sm" style={{ color: '#e5484d' }}>{error}</p>}
    </>
  );
}
