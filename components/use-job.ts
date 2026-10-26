'use client';

import { useEffect, useState } from 'react';
import type { JobEvent } from '@/lib/app/jobs/jobs';

/** Live events of a job (replayed from the start), and whether it is still running. */
export function useJob(projectId: string, jobId: string | null): { events: JobEvent[]; running: boolean } {
  const [events, setEvents] = useState<JobEvent[]>([]);
  useEffect(() => {
    setEvents([]);
    if (!jobId) return;
    const es = new EventSource(`/api/projects/${projectId}/jobs/${jobId}/events`);
    es.onmessage = (m) => setEvents((cur) => [...cur, JSON.parse(m.data) as JobEvent]);
    es.onerror = () => es.close();
    return () => es.close();
  }, [projectId, jobId]);
  const last = [...events].reverse().find((e) => e.type === 'state');
  return { events, running: !!jobId && (!last || (last.type === 'state' && last.state === 'running')) };
}
