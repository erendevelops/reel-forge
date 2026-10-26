'use client';

import { useRef } from 'react';
import { t, type Language } from '@/lib/i18n';
import { diffPlans } from '@/lib/app/edits';
import type { Plan } from '@/lib/plan/schema';
import type { VersionOrigin } from '@/lib/app/workspace/schema';

export type VersionView = { n: number; plan: Plan; origin: VersionOrigin; renders: { ratio: string; profile: string; url: string }[] };

const pickRender = (v: VersionView, ratio: string) => v.renders.find((r) => r.ratio === ratio && r.profile === 'final') ?? v.renders.find((r) => r.ratio === ratio);

/** Two versions side by side at one ratio, "play both", and what changed between them. */
export function CompareVersions({
  lang,
  versions,
  a,
  b,
  ratio,
  onPick,
}: {
  lang: Language;
  versions: VersionOrigin[];
  a: VersionView | null;
  b: VersionView | null;
  ratio: string;
  onPick: (side: 'a' | 'b', n: number) => void;
}) {
  const d = t(lang).review;
  const refs = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)];
  const sides = [a, b] as const;
  const changes = a && b ? diffPlans(a.plan, b.plan) : [];
  return (
    <div className="card flex flex-col gap-3 px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="meta font-mono">{d.compare}</span>
        <span className="flex-1" />
        <button
          type="button"
          className="btn"
          onClick={() =>
            refs.forEach((r) => {
              if (!r.current) return;
              r.current.currentTime = 0;
              void r.current.play();
            })
          }
        >
          {d.playBoth}
        </button>
      </div>
      <div className="compare grid grid-cols-2 gap-4">
        {sides.map((v, i) => {
          const src = v ? pickRender(v, ratio) : undefined;
          return (
            <div key={i} className="flex flex-col gap-2">
              <select className="card px-2 py-1 font-mono text-xs" value={v?.n ?? ''} onChange={(e) => onPick(i === 0 ? 'a' : 'b', Number(e.target.value))}>
                {versions.map((o) => (
                  <option key={o.n} value={o.n}>
                    v{o.n}
                  </option>
                ))}
              </select>
              {src ? <video ref={refs[i]} src={src.url} controls playsInline className="w-full rounded-xl" /> : <p className="meta">{d.noRender}</p>}
              {v?.origin.by === 'claude' && v.origin.request && <p className="meta text-xs">“{v.origin.request}”</p>}
            </div>
          );
        })}
      </div>
      {changes.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="meta font-mono text-xs">{d.changes}</span>
          <ul className="flex flex-col gap-1 font-mono text-xs">
            {changes.slice(0, 40).map((c) => (
              <li key={c.path} className="flex gap-2">
                <span>{c.path}</span>
                <span className="meta">
                  {JSON.stringify(c.from)} → {JSON.stringify(c.to)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
