'use client';

import { useEffect, useRef, useState } from 'react';
import { JobLog } from '@/components/JobLog';
import { t, type Language } from '@/lib/i18n';
import type { JobEvent } from '@/lib/app/jobs/jobs';
import type { VersionOrigin } from '@/lib/app/workspace/schema';
import type { Stage } from '@/lib/app/flow';
import { postJob } from '@/components/post-job';

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
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState('');
  const claude = (body: object) => start(body, `/api/projects/${projectId}/claude`);
  const latest = versions.at(-1)?.n ?? null;
  const refreshed = useRef<string | null>(null);

  // when a job started here finishes, reload the page so it opens the next stage (music, transcript, storyboard…)
  useEffect(() => {
    const last = [...events].reverse().find((e) => e.type === 'state');
    if (jobId && jobId !== lastJobId && last?.type === 'state' && last.state === 'done' && refreshed.current !== jobId) {
      refreshed.current = jobId;
      window.location.reload();
    }
  }, [events, jobId, lastJobId]);

  useEffect(() => {
    if (!jobId) return;
    setEvents([]);
    const es = new EventSource(`/api/projects/${projectId}/jobs/${jobId}/events`);
    es.onmessage = (m) => setEvents((cur) => [...cur, JSON.parse(m.data) as JobEvent]);
    es.onerror = () => es.close();
    return () => es.close();
  }, [projectId, jobId]);

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
        {versions.length === 0 && (
          <div className="flex items-center gap-3">
            <p className="meta">{d.noVersions}</p>
            {stage === 'analyse' && (
              <button type="button" className="btn btn-primary" onClick={() => claude({ stage: 'analyse' })}>
                {d.analyse}
              </button>
            )}
            {stage === 'plan' && (
              <button type="button" className="btn btn-primary" onClick={() => claude({ stage: 'plan' })}>
                {d.makePlan}
              </button>
            )}
          </div>
        )}
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
