'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CompareVersions, type VersionView } from '@/components/CompareVersions';
import { JobLog } from '@/components/JobLog';
import { PreferenceOffer } from '@/components/PreferenceOffer';
import { QaSummary } from '@/components/QaSummary';
import { postJob } from '@/components/post-job';
import { useJob } from '@/components/use-job';
import { t, type Language } from '@/lib/i18n';
import type { QaReport } from '@/lib/render/qa';
import type { VersionOrigin } from '@/lib/app/workspace/schema';

type Loaded = VersionView & { qa: Record<string, QaReport>; thumbs: string[] };

/** Review (spec §11 screen 7): the renders, QA per gate, version compare and feedback to Claude. */
export function ReviewClient({ lang, projectId, versions, current, lastJobId }: { lang: Language; projectId: string; versions: VersionOrigin[]; current: number; lastJobId: string | null }) {
  const d = t(lang).review;
  const router = useRouter();
  const [views, setViews] = useState<Record<number, Loaded>>({});
  const parent = versions.find((v) => v.n === current)?.parent ?? null;
  const [pair, setPair] = useState<{ a: number; b: number }>({ a: parent ?? current, b: current });
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(lastJobId);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const job = useJob(projectId, jobId);

  useEffect(() => {
    for (const n of new Set([current, pair.a, pair.b])) {
      if (views[n]) continue;
      void fetch(`/api/projects/${projectId}/versions/${n}`)
        .then(async (r) => {
          if (!r.ok) throw new Error(`v${n}: ${r.statusText}`);
          return (await r.json()) as Omit<Loaded, 'n'>;
        })
        .then((v) => setViews((cur) => ({ ...cur, [n]: { ...v, n } })))
        .catch((e: Error) => setError(e.message));
    }
  }, [projectId, current, pair, views]);

  useEffect(() => {
    if (!jobId || job.running) return;
    router.refresh();
    // a revise job hands over to the automatic draft render: follow that one (it starts a moment after this one ends)
    const timer = setTimeout(() => {
      void fetch(`/api/projects/${projectId}/jobs`)
        .then((r) => (r.ok ? r.json() : []))
        .then((jobs: { jobId: string; state: string }[]) => {
          const next = jobs.find((j) => j.state === 'running');
          if (next && next.jobId !== jobId) setJobId(next.jobId);
        })
        .catch(() => undefined);
    }, 1500);
    return () => clearTimeout(timer);
  }, [jobId, job.running, router, projectId]);

  async function revise(request: string) {
    setError(null);
    const out = await postJob(`/api/projects/${projectId}/claude`, { stage: 'revise', request }, lang);
    if ('error' in out) return setError(out.error);
    setJobId(out.jobId);
  }

  const cur = views[current];
  const ratio = cur?.renders[0]?.ratio ?? '9:16';
  return (
    <div className="grid grid-cols-[1fr_380px] gap-7">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-4">
          {cur?.renders
            .filter((r) => r.profile === 'final' || !cur.renders.some((x) => x.ratio === r.ratio && x.profile === 'final'))
            .map((r) => (
              <div key={r.url} className="flex flex-col gap-1">
                <span className="meta font-mono text-xs">{r.ratio}</span>
                <video src={r.url} poster={cur.thumbs[0]} controls playsInline style={{ maxHeight: 520 }} className="rounded-xl" />
              </div>
            ))}
        </div>
        <CompareVersions lang={lang} versions={versions} a={views[pair.a] ?? null} b={views[pair.b] ?? null} ratio={ratio} onPick={(side, n) => setPair((p) => ({ ...p, [side]: n }))} />
      </div>
      <div className="side flex flex-col gap-4">
        {cur && <QaSummary lang={lang} reports={cur.qa} onFix={revise} />}
        {job.running ? (
          <JobLog lang={lang} events={job.events} onResume={() => void postJob(`/api/projects/${projectId}/jobs/${jobId}/resume`, {}, lang)} />
        ) : (
          <input
            className="card px-4 py-3"
            aria-label={d.feedback}
            placeholder={`${d.feedback}…`}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || !feedback.trim()) return;
              e.preventDefault();
              void revise(feedback.trim());
              setFeedback('');
            }}
          />
        )}
        <Link className="meta font-mono text-xs" href={`/projects/${projectId}?view=storyboard`}>
          {d.toStoryboard}
        </Link>
        {job.preference && job.preference !== dismissed && <PreferenceOffer lang={lang} text={job.preference} projectId={projectId} onDone={() => setDismissed(job.preference)} />}
        {error && <p className="font-mono text-sm" style={{ color: '#e5484d' }}>{error}</p>}
      </div>
    </div>
  );
}
