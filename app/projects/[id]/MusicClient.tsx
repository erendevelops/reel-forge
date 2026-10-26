'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { JobLog } from '@/components/JobLog';
import { MusicPick } from '@/components/MusicPick';
import { postJob } from '@/components/post-job';
import { useJob } from '@/components/use-job';
import type { Language } from '@/lib/i18n';
import type { Candidate } from '@/lib/app/music';
import type { MusicPick as Picked } from '@/lib/app/workspace/schema';

export function MusicClient({ lang, projectId, candidates, picked }: { lang: Language; projectId: string; candidates: Candidate[]; picked: Picked | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const job = useJob(projectId, jobId);
  useEffect(() => {
    if (jobId && !job.running) router.refresh();
  }, [jobId, job.running, router]);

  async function send(method: 'POST' | 'PUT', body: BodyInit, json: boolean) {
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/music`, { method, body, headers: json ? { 'content-type': 'application/json' } : undefined });
    if (!res.ok) return setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? res.statusText);
    router.refresh();
  }

  return (
    <div className="grid grid-cols-[1fr_340px] gap-7">
      <div className="flex flex-col gap-3">
        <MusicPick
          lang={lang}
          candidates={candidates}
          picked={picked}
          onPick={(i) => send('POST', JSON.stringify({ pick: i }), true)}
          onUpload={(f) => {
            const fd = new FormData();
            fd.append('file', f);
            void send('PUT', fd, false);
          }}
          onMore={async () => {
            const out = await postJob(`/api/projects/${projectId}/claude`, { stage: 'music' }, lang);
            if ('error' in out) setError(out.error);
            else setJobId(out.jobId);
          }}
        />
        {error && <p className="font-mono text-sm" style={{ color: '#e5484d' }}>{error}</p>}
      </div>
      <div>{jobId && <JobLog lang={lang} events={job.events} onResume={() => postJob(`/api/projects/${projectId}/jobs/${jobId}/resume`, {}, lang)} />}</div>
    </div>
  );
}
