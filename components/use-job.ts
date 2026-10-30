'use client';

import { useEffect, useRef, useState } from 'react';
import type { JobEvent } from '@/lib/app/jobs/jobs';

/**
 * Live events of a job (replayed), whether it still runs, and a preference Claude proposed in it.
 * `reloadOnDone`: when a job finishes while this page watches it (not an old finish replayed from the log), the page
 * reloads so it opens the next step (a new version, the music pick, the storyboard…). Pass false to hold the page,
 * e.g. while there are unsaved edits.
 */
export function useJob(projectId: string, jobId: string | null, reloadOnDone = true): { events: JobEvent[]; running: boolean; preference: string | null } {
  const [events, setEvents] = useState<JobEvent[]>([]);
  const mountedAt = useRef(Date.now());
  const reloaded = useRef(false);
  useEffect(() => {
    setEvents([]);
    if (!jobId) return;
    const es = new EventSource(`/api/projects/${projectId}/jobs/${jobId}/events`);
    es.onmessage = (m) => setEvents((cur) => [...cur, JSON.parse(m.data) as JobEvent]);
    es.onerror = () => es.close();
    return () => es.close();
  }, [projectId, jobId]);
  const last = [...events].reverse().find((e) => e.type === 'state');
  const finishedLive = last?.type === 'state' && last.state === 'done' && Date.parse(last.t) > mountedAt.current - 2000;
  useEffect(() => {
    if (finishedLive && reloadOnDone && !reloaded.current) {
      reloaded.current = true;
      // give a chained job (the automatic draft render after a plan) a moment to start, so the next page shows it
      setTimeout(() => window.location.reload(), 1200);
    }
  }, [finishedLive, reloadOnDone]);
  const pref = [...events].reverse().find((e) => e.type === 'preference');
  return { events, running: !!jobId && (!last || (last.type === 'state' && last.state === 'running')), preference: pref?.type === 'preference' ? pref.text : null };
}
