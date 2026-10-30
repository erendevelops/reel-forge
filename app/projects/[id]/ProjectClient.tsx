'use client';

import { useState } from 'react';
import { JobLog } from '@/components/JobLog';
import { t, type Language } from '@/lib/i18n';
import type { VersionOrigin } from '@/lib/app/workspace/schema';
import type { Stage } from '@/lib/app/flow';
import { postJob } from '@/components/post-job';
import { useJob } from '@/components/use-job';

export function ProjectClient({
  lang,
  projectId,
  stage,
  versions,
  lastJobId,
}: {
  lang: Language;
  projectId: string;
  stage: Stage;
  versions: VersionOrigin[];
  lastJobId: string | null;
}) {
  const d = t(lang).projects;
  const [jobId, setJobId] = useState<string | null>(lastJobId);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState('');
  const claude = (body: object) => start(body, `/api/projects/${projectId}/claude`);
  const latest = versions.at(-1)?.n ?? null;
  const job = useJob(projectId, jobId);
  const events = job.events;

  async function start(body: object, url = `/api/projects/${projectId}/jobs`) {
    setError(null);
    const out = await postJob(url, body, lang);
    if ('error' in out) return setError(out.error);
    setJobId(out.jobId);
  }

  return (
    <div className="grid grid-cols-[1fr_340px] gap-7">
      <div className="flex flex-col gap-3">
        <div className="meta uppercase tracking-widest">{d.versions}</div>
        {versions.length === 0 && !job.running && (stage === 'analyse' || stage === 'plan') && (
          // the one thing to do next, spelled out: what it does, how long, where it goes after
          <div className="card flex flex-col gap-3 px-6 py-5" style={{ borderColor: '#1f9d6b', borderWidth: 2 }}>
            <span className="meta uppercase tracking-widest">{d.nextStep}</span>
            <div className="text-lg font-semibold">{stage === 'plan' ? d.makePlan : d.analyse}</div>
            <p className="meta">{stage === 'plan' ? d.planHint : d.analyseHint}</p>
            <button type="button" className="btn btn-primary self-start" onClick={() => claude({ stage })}>
              {stage === 'plan' ? d.makePlan : d.analyse} →
            </button>
          </div>
        )}
        {versions.length === 0 && stage !== 'analyse' && stage !== 'plan' && <p className="meta">{d.noVersions}</p>}
        {versions.map((v) => (
          <div key={v.n} className="card flex items-center gap-4 px-5 py-3">
            <span className="font-px">v{v.n}</span>
            <span className="meta flex-1">{v.request ?? (v.by === 'user' ? '✎' : '')}</span>
            <span className="meta">{v.by}</span>
          </div>
        ))}
        {latest && (
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn" onClick={() => start({ kind: 'render', version: latest, profile: 'draft' })}>
              {d.renderDraft}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => start({ kind: 'render', version: latest, profile: 'final' })}>
              {d.renderFinal}
            </button>
          </div>
        )}
        {latest && (
          <form
            className="flex gap-2 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!request.trim()) return;
              void claude({ stage: 'revise', request });
              setRequest('');
            }}
          >
            <input className="card flex-1 px-4 py-3" placeholder={d.tellClaude} value={request} onChange={(e) => setRequest(e.target.value)} />
            <button type="submit" className="btn">{d.send}</button>
          </form>
        )}
        {error && <p className="font-mono text-sm" style={{ color: '#e5484d' }}>{error}</p>}
      </div>
      <div className="min-w-0">{jobId && <JobLog lang={lang} events={events} onResume={() => start({}, `/api/projects/${projectId}/jobs/${jobId}/resume`)} />}</div>
    </div>
  );
}
