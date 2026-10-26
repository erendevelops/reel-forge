'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AskClaude } from '@/components/AskClaude';
import { JobLog } from '@/components/JobLog';
import { PreferenceOffer } from '@/components/PreferenceOffer';
import { PreviewPlayer } from '@/components/PreviewPlayer';
import { SceneDetail } from '@/components/SceneDetail';
import { SceneList } from '@/components/SceneList';
import { VersionPicker } from '@/components/VersionPicker';
import { postJob } from '@/components/post-job';
import { useJob } from '@/components/use-job';
import { t, type Language } from '@/lib/i18n';
import { EditError, applyEdit, type Edit } from '@/lib/app/edits';
import type { Plan, Ratio } from '@/lib/plan/schema';
import type { Preset, VersionOrigin } from '@/lib/app/workspace/schema';

type ProjectInfo = { id: string; mode: 'reel' | 'app'; preset: Preset; ratios: Ratio[] };

/** Edits of the same field collapse into one (typing a name is one edit, not one per key). */
function sameTarget(a: Edit, b: Edit): boolean {
  if (a.op !== b.op) return false;
  const { value: _a, start: _s1, end: _e1, at: _t1, volume: _v1, mediaStart: _m1, text: _x1, from: _f1, ...ka } = a as Record<string, unknown>;
  const { value: _b, start: _s2, end: _e2, at: _t2, volume: _v2, mediaStart: _m2, text: _x2, from: _f2, ...kb } = b as Record<string, unknown>;
  return JSON.stringify(ka) === JSON.stringify(kb);
}

/**
 * The storyboard workspace (spec §11 screen 6, approved mockup): scene list on the left; on the right a sticky live
 * preview with ratio tabs, the selected scene's why and edits, "ask Claude", the version picker and Approve & render.
 * Direct edits stay local until saved as a user version.
 */
export function StoryboardClient({
  lang,
  project,
  versions,
  initial,
  lastJobId,
}: {
  lang: Language;
  project: ProjectInfo;
  versions: VersionOrigin[];
  initial: { n: number; plan: Plan };
  lastJobId: string | null;
}) {
  const d = t(lang).storyboard;
  const router = useRouter();
  const [n, setN] = useState(initial.n);
  const [base, setBase] = useState(initial.plan);
  const [edits, setEdits] = useState<Edit[]>([]);
  const [selected, setSelected] = useState(initial.plan.scenes[0]?.id ?? '');
  const [ratio, setRatio] = useState<Ratio>(project.ratios[0]);
  const [src, setSrc] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(lastJobId);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const job = useJob(project.id, jobId);
  const known = useRef(versions.at(-1)?.n ?? 0);

  const plan = useMemo(() => edits.reduce(applyEdit, base), [base, edits]);
  const current = plan.scenes.find((s) => time >= s.start && time < s.end)?.id ?? null;

  async function load(v: number) {
    const res = await fetch(`/api/projects/${project.id}/versions/${v}`);
    if (!res.ok) return setError(res.statusText);
    const out = (await res.json()) as { plan: Plan };
    setBase(out.plan);
    setEdits([]);
    setN(v);
  }

  // a version Claude saved while we were open becomes the one shown
  useEffect(() => {
    const latest = versions.at(-1)?.n ?? 0;
    if (latest > known.current) {
      known.current = latest;
      void load(latest);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versions]);

  useEffect(() => {
    if (jobId && !job.running) router.refresh();
  }, [jobId, job.running, router]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/projects/${project.id}/preview`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan, ratio }) });
      const out = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (out.url) setSrc(out.url);
      else if (out.error) setError(out.error);
    }, 400);
    return () => clearTimeout(timer);
  }, [plan, ratio, project.id]);

  function edit(e: Edit) {
    setError(null);
    const last = edits.at(-1);
    const next = last && sameTarget(last, e) ? [...edits.slice(0, -1), last.op === 'sfx' ? ({ ...last, ...e } as Edit) : e] : [...edits, e];
    try {
      next.reduce(applyEdit, base);
      setEdits(next);
    } catch (err) {
      if (err instanceof EditError) setError(err.message);
      else throw err;
    }
  }

  async function save() {
    setError(null);
    const res = await fetch(`/api/projects/${project.id}/versions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ parent: n, edits }) });
    const out = (await res.json().catch(() => ({}))) as { n?: number; branched?: boolean; error?: unknown };
    if (!res.ok || !out.n) return setError(Array.isArray(out.error) ? out.error.join('\n') : String(out.error ?? res.statusText));
    known.current = out.n;
    setNote(out.branched ? `v${out.n} · ${d.branched} (v${n})` : null);
    setBase(plan);
    setEdits([]);
    setN(out.n);
    router.refresh();
  }

  async function start(url: string, body: object) {
    setError(null);
    const out = await postJob(url, body, lang);
    if ('error' in out) return setError(out.error);
    setJobId(out.jobId);
  }

  const seekTo = (id: string) => {
    setSelected(id);
    const s = plan.scenes.find((x) => x.id === id);
    if (s) setTime(s.start);
  };

  return (
    <div className="grid grid-cols-[1fr_380px] gap-7">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <VersionPicker lang={lang} versions={versions} value={n} onChange={(v) => void load(v)} />
          <a className="meta font-mono text-xs" href={`/projects/${project.id}/cards`}>
            {d.changeCards}
          </a>
          <a className="meta font-mono text-xs" href={`/projects/${project.id}?view=review`}>
            {d.review}
          </a>
          <span className="flex-1" />
          {edits.length > 0 && (
            <>
              <button type="button" className="btn" onClick={() => setEdits((x) => x.slice(0, -1))}>
                {d.undo}
              </button>
              <button type="button" className="btn btn-primary" disabled={job.running} onClick={save}>
                {`${d.save} (${edits.length})`}
              </button>
            </>
          )}
        </div>
        {note && <p className="meta font-mono text-xs">{note}</p>}
        <SceneList lang={lang} plan={plan} selected={selected} current={playing ? current : null} onSelect={seekTo} />
      </div>
      <div className="side flex flex-col gap-4">
        {project.ratios.length > 1 && (
          <div className="seg font-mono text-xs">
            {project.ratios.map((r) => (
              <button key={r} type="button" className={r === ratio ? 'on' : ''} onClick={() => setRatio(r)}>
                {r}
              </button>
            ))}
          </div>
        )}
        <PreviewPlayer lang={lang} src={src} ratio={ratio} duration={plan.duration} time={time} playing={playing} onTime={setTime} onPlaying={setPlaying} />
        <SceneDetail lang={lang} plan={plan} sceneId={selected} app={project.mode === 'app'} onEdit={edit} />
        {job.running ? (
          <JobLog lang={lang} events={job.events} onResume={() => void start(`/api/projects/${project.id}/jobs/${jobId}/resume`, {})} />
        ) : (
          <AskClaude lang={lang} sceneId={selected || null} onSend={(request) => void start(`/api/projects/${project.id}/claude`, { stage: 'revise', request })} />
        )}
        <button type="button" className="btn btn-primary" disabled={job.running || edits.length > 0} onClick={() => void start(`/api/projects/${project.id}/jobs`, { kind: 'render', version: n, profile: 'final' })}>
          {d.approve}
        </button>
        {job.preference && job.preference !== dismissed && <PreferenceOffer lang={lang} text={job.preference} projectId={project.id} onDone={() => setDismissed(job.preference)} />}
        {error && <p className="whitespace-pre-wrap font-mono text-sm" style={{ color: '#e5484d' }}>{error}</p>}
      </div>
    </div>
  );
}
