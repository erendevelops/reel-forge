'use client';

import { useEffect, useState } from 'react';
import { JobLog } from '@/components/JobLog';
import { t, type Language } from '@/lib/i18n';
import type { JobEvent } from '@/lib/app/jobs/jobs';
import type { VersionOrigin } from '@/lib/app/workspace/schema';

export function ProjectClient({
  lang,
  projectId,
  versions,
  lastJobId,
}: {
  lang: Language;
  projectId: string;
  versions: VersionOrigin[];
  lastJobId: string | null;
}) {
  const d = t(lang).projects;
  const [jobId, setJobId] = useState<string | null>(lastJobId);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const latest = versions.at(-1)?.n ?? null;

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
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const out = await res.json();
    if (!res.ok) return setError(typeof out.error === 'string' ? out.error : JSON.stringify(out.error));
    setJobId(out.jobId);
  }

  return (
    <div className="grid grid-cols-[1fr_340px] gap-7">
      <div className="flex flex-col gap-3">
        <div className="meta uppercase tracking-widest">{d.versions}</div>
        {versions.length === 0 && <p className="meta">{d.noVersions}</p>}
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
        {error && <p className="font-mono text-sm" style={{ color: '#e5484d' }}>{error}</p>}
      </div>
      <div>{jobId && <JobLog lang={lang} events={events} onResume={() => start({}, `/api/projects/${projectId}/jobs/${jobId}/resume`)} />}</div>
    </div>
  );
}
