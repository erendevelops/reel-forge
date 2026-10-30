'use client';

import { useEffect, useState } from 'react';
import { t, type Language } from '@/lib/i18n';
import type { Edit } from '@/lib/app/edits';
import type { ClipSource } from '@/lib/app/clip-pick';
import type { Plan } from '@/lib/plan/schema';

const base = (f: string) => f.split('/').pop() ?? f;

/**
 * The scene's shots, each swappable for another part of the user's videos: pick a video, a start second (or one of
 * the analysis's moments), see that frame, and the app cuts a working clip of the shot's length (`shot-clip` edit).
 */
export function ShotPicker({ lang, projectId, plan, sceneId, onEdit }: { lang: Language; projectId: string; plan: Plan; sceneId: string; onEdit: (e: Edit) => void }) {
  const d = t(lang).storyboard;
  const scene = plan.scenes.find((s) => s.id === sceneId);
  const [sources, setSources] = useState<ClipSource[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [src, setSrc] = useState('');
  const [from, setFrom] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open === null || sources) return;
    fetch(`/api/projects/${projectId}/clip`)
      .then((r) => r.json())
      .then((j: { sources?: ClipSource[] }) => {
        setSources(j.sources ?? []);
        if (j.sources?.[0]) setSrc((cur) => cur || j.sources![0].file);
      })
      .catch(() => setSources([]));
  }, [open, sources, projectId]);

  if (!scene || scene.shots.length === 0) return null;
  const current = sources?.find((s) => s.file === src);

  async function use(shot: number) {
    const sh = scene!.shots[shot];
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/clip`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ src, from, duration: Number((sh.to - sh.from).toFixed(3)), ratio: plan.ratios[0], fps: plan.fps }),
      });
      const j = (await res.json()) as { src?: string; error?: unknown };
      if (!res.ok || !j.src) throw new Error(typeof j.error === 'string' ? j.error : res.statusText);
      onEdit({ op: 'shot-clip', scene: scene!.id, shot, src: j.src });
      setOpen(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="card flex flex-col gap-2 px-4 py-3" open={open !== null || undefined}>
      <summary className="meta cursor-pointer font-mono">
        {d.shots} ({scene.shots.length})
      </summary>
      {scene.shots.map((sh, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="meta flex-1 truncate font-mono">
              {d.shot} {i + 1} · {(sh.to - sh.from).toFixed(1)} {d.seconds} · {base(sh.src)}
            </span>
            <button type="button" className="btn" onClick={() => setOpen(open === i ? null : i)}>
              {open === i ? d.cancel : d.change}
            </button>
          </div>
          {open === i && (
            <div className="flex flex-col gap-2">
              {sources === null ? (
                <span className="meta">…</span>
              ) : sources.length === 0 ? (
                <span className="meta">{d.noSources}</span>
              ) : (
                <>
                  <label className="field">
                    <span className="meta font-mono">{d.video}</span>
                    <select aria-label={d.video} value={src} onChange={(e) => { setSrc(e.target.value); setFrom(0); }}>
                      {sources.map((s) => (
                        <option key={s.file} value={s.file}>
                          {base(s.file)}{s.content ? ` · ${s.content.slice(0, 60)}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  {current && current.moments.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <span className="meta font-mono">{d.moments}</span>
                      {current.moments.map((m, mi) => (
                        <button key={mi} type="button" className="btn text-left" onClick={() => setFrom(m.at)}>
                          {m.at} {d.seconds} · {m.what}
                        </button>
                      ))}
                    </div>
                  )}
                  <label className="field">
                    <span className="meta font-mono">{d.from}</span>
                    <input aria-label={d.from} type="number" min={0} max={current?.duration || undefined} step={0.25} value={from} onChange={(e) => setFrom(Math.max(0, Number(e.target.value) || 0))} />
                  </label>
                  {src && <img alt="" className="w-40 rounded" src={`/api/projects/${projectId}/clip?src=${encodeURIComponent(src)}&t=${from}`} />}
                  <button type="button" className="btn btn-primary" disabled={busy || !src} onClick={() => void use(i)}>
                    {busy ? d.cutting : d.use}
                  </button>
                  {error && <span className="meta text-red-600">{error}</span>}
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </details>
  );
}
