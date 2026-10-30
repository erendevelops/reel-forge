'use client';

import { useState } from 'react';
import { t, type Language } from '@/lib/i18n';
import { editableParams, type Edit } from '@/lib/app/edits';
import type { Plan } from '@/lib/plan/schema';

const KIT = ['background', 'card', 'ink', 'muted', 'accent'] as const;

/** A number input that keeps what is typed and commits on blur/Enter, so "1" on the way to "12" is never refused. */
function NumberField({ value, step, onCommit, ...rest }: { value: number; step: number; onCommit: (v: number) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft.trim() !== '' && Number.isFinite(Number(draft)) && Number(draft) !== value) onCommit(Number(draft));
    setDraft(null);
  };
  return (
    <input
      {...rest}
      type="number"
      step={step}
      value={draft ?? String(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
      }}
    />
  );
}

/**
 * The selected scene's details: Claude's reason, each card's editable text/numbers and timing, list item times, the
 * scene's sound cues; for app videos the kit colours (animations themselves change through Claude).
 */
export function SceneDetail({ lang, plan, sceneId, app, onEdit }: { lang: Language; plan: Plan; sceneId: string; app: boolean; onEdit: (e: Edit) => void }) {
  const d = t(lang).storyboard;
  const scene = plan.scenes.find((s) => s.id === sceneId);
  if (!scene) return null;
  const cues = plan.sfx.map((c, i) => ({ c, i })).filter(({ c }) => c.at >= scene.start && c.at < scene.end);
  return (
    <div className="flex flex-col gap-3">
      {/* the scene row already shows the why when there is no spoken line (app videos) */}
      {scene.say.trim() && (
        <div className="why">
          <b>{d.why}</b> <span>{scene.why}</span>
        </div>
      )}
      {scene.cards.map((card, ci) => {
        const items = (card.params as { items?: { at?: number; name?: string; label?: string }[] }).items;
        return (
          <div key={ci} className="card flex flex-col gap-2 px-4 py-3">
            <span className="meta font-mono">{card.type}</span>
            {editableParams(card).map((p) => (
              <label key={p.key} className="field">
                <span className="meta font-mono">{p.key}</span>
                {p.kind === 'number' ? (
                  <NumberField aria-label={p.key} step={1} value={card.params[p.key] as number} onCommit={(v) => onEdit({ op: 'card-param', scene: scene.id, card: ci, key: p.key, value: v })} />
                ) : (
                  <input aria-label={p.key} value={String(card.params[p.key])} onChange={(e) => onEdit({ op: 'card-param', scene: scene.id, card: ci, key: p.key, value: e.target.value })} />
                )}
              </label>
            ))}
            <div className="flex gap-2">
              <label className="field">
                <span className="meta font-mono">{d.start}</span>
                <NumberField step={0.01} value={card.start} onCommit={(v) => onEdit({ op: 'card-time', scene: scene.id, card: ci, start: v, end: card.end })} />
              </label>
              <label className="field">
                <span className="meta font-mono">{d.end}</span>
                <NumberField step={0.01} value={card.end} onCommit={(v) => onEdit({ op: 'card-time', scene: scene.id, card: ci, start: card.start, end: v })} />
              </label>
            </div>
            {Array.isArray(items) &&
              items.map((it, ii) =>
                typeof it.at === 'number' ? (
                  <label key={ii} className="field">
                    <span className="meta font-mono">{it.name ?? it.label ?? ii + 1}</span>
                    <NumberField step={0.01} value={it.at} onCommit={(v) => onEdit({ op: 'item-at', scene: scene.id, card: ci, item: ii, at: v })} />
                  </label>
                ) : null,
              )}
          </div>
        );
      })}
      {cues.length > 0 && (
        <details className="card flex flex-col gap-2 px-4 py-3">
          <summary className="meta cursor-pointer font-mono">
            {d.sounds} ({cues.length})
          </summary>
          {cues.map(({ c, i }) => (
            <div key={i} className="flex items-center gap-2">
              <span className="meta flex-1 truncate font-mono">{c.file.replace(/^sfx\//, '')}</span>
              <NumberField aria-label={`${d.at} ${i}`} className="w-20" step={0.01} value={c.at} onCommit={(v) => onEdit({ op: 'sfx', index: i, at: v })} />
              <NumberField aria-label={`${d.volume} ${i}`} className="w-16" step={0.05} value={c.volume} onCommit={(v) => onEdit({ op: 'sfx', index: i, volume: v })} />
            </div>
          ))}
        </details>
      )}
      {app && (
        <div className="card flex flex-col gap-2 px-4 py-3">
          <span className="meta font-mono">{d.colors}</span>
          <div className="flex flex-wrap gap-3">
            {KIT.map((k) => (
              <label key={k} className="flex items-center gap-1">
                <input aria-label={k} type="color" value={(plan.look?.[k] as string | undefined) ?? '#ffffff'} onChange={(e) => onEdit({ op: 'look', key: k, value: e.target.value })} />
                <span className="meta font-mono">{k}</span>
              </label>
            ))}
          </div>
          <span className="meta">{d.animNote}</span>
        </div>
      )}
    </div>
  );
}
