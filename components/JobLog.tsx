'use client';

import { t, type Language } from '@/lib/i18n';
import type { JobEvent } from '@/lib/app/jobs/jobs';

const RATIO_STEP = /^(9:16|16:9|1:1|4:5) (\w+)$/;

/** A tool summary without the long project path (`cd "C:/…/projects/<id>" && rf …` → `rf …`). */
export function shortStep(s: string): string {
  return s
    .replace(/cd\s+"?[^"&;]*[\\/]projects[\\/][a-z0-9-]+"?\s*(&&|;)?\s*/gi, '')
    .replace(/[A-Za-z]:[\\/][^\s"]*?[\\/]projects[\\/][a-z0-9-]+[\\/]?/gi, '')
    .trim() || s;
}

/** A calm step list: one row per Claude tool call, one bar per ratio, and the end state. */
export function JobLog({ lang, events, onResume }: { lang: Language; events: JobEvent[]; onResume: () => void }) {
  const d = t(lang).jobs;
  const tools = events.flatMap((e) => (e.type === 'claude' && e.event.kind === 'tool' ? [e.event.summary] : []));
  const ratios = new Map<string, string>();
  for (const e of events) {
    const m = e.type === 'progress' ? RATIO_STEP.exec(e.step) : null;
    if (m) ratios.set(m[1], m[2]);
  }
  const state = [...events].reverse().find((e) => e.type === 'state');
  const label: Record<string, string> = { running: d.running, done: d.done, failed: d.failed, cancelled: d.cancelled, 'paused-limit': d.pausedLimit };

  return (
    <div className="card flex flex-col gap-3 p-5">
      {state?.type === 'state' && (
        <div className="font-mono text-sm">
          {label[state.state]}
          {state.state === 'failed' && state.detail ? ` — ${state.detail}` : ''}
        </div>
      )}
      {[...ratios].map(([ratio, stage]) => (
        <div key={ratio} data-ratio={ratio} data-stage={stage} className="flex items-center gap-3">
          <span className="meta w-12">{ratio}</span>
          <span className="h-2 flex-1 rounded-full" style={{ background: 'var(--soft)' }}>
            <span className="block h-2 rounded-full" style={{ width: stage === 'done' ? '100%' : stage === 'qa' ? '80%' : '40%', background: 'var(--brand)' }} />
          </span>
          <span className="meta w-14">{stage}</span>
        </div>
      ))}
      <ol className="flex flex-col gap-1">
        {tools.map((s, i) => (
          <li key={i} className="meta">
            {shortStep(s)}
          </li>
        ))}
      </ol>
      {state?.type === 'state' && state.state === 'paused-limit' && (
        <div className="flex items-center gap-3">
          <span className="text-sm">
            {d.resetsAt}: {state.detail}
          </span>
          <button type="button" className="btn btn-primary" onClick={onResume}>
            {d.resume}
          </button>
        </div>
      )}
    </div>
  );
}
