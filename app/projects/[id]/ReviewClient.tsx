'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CompareVersions, type VersionView } from '@/components/CompareVersions';
import { JobLog } from '@/components/JobLog';
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
  const job = useJob(projectId, jobId);

  useEffect(() => {
    for (const n of new Set([current, pair.a, pair.b])) {
      if (views[n]) continue;
      void fetch(`/api/projects/${projectId}/versions/${n}`)
        .then((r) => r.json())
        .then((v: Omit<Loaded, 'n'>) => setViews((cur) => ({ ...cur, [n]: { ...v, n } })));
    }
  }, [projectId, current, pair, views]);

  useEffect(() => {
    if (jobId && !job.running) router.refresh();
  }, [jobId, job.running, router]);

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
        <a className="meta font-mono text-xs" href={`/projects/${projectId}?view=storyboard`}>
          {d.toStoryboard}
        </a>
        {error && <p className="font-mono text-sm" style={{ color: '#e5484d' }}>{error}</p>}
      </div>
    </div>
  );
}
