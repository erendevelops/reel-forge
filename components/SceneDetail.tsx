'use client';

import { t, type Language } from '@/lib/i18n';
import { editableParams, type Edit } from '@/lib/app/edits';
import type { Plan } from '@/lib/plan/schema';

const KIT = ['background', 'card', 'ink', 'muted', 'accent'] as const;

/**
 * The selected scene's details: Claude's reason, each card's editable text/numbers and timing, list item times, the
 * scene's sound cues; for app videos the kit colours (animations themselves change through Claude).
 */
export function SceneDetail({ lang, plan, sceneId, app, onEdit }: { lang: Language; plan: Plan; sceneId: string; app: boolean; onEdit: (e: Edit) => void }) {
  const d = t(lang).storyboard;
  const scene = plan.scenes.find((s) => s.id === sceneId);
  if (!scene) return null;
  const num = (v: string) => Number(v);
  const cues = plan.sfx.map((c, i) => ({ c, i })).filter(({ c }) => c.at >= scene.start && c.at < scene.end);
  return (
    <div className="flex flex-col gap-3">
      <div className="why">
        <b>{d.why}</b> <span>{scene.why}</span>
      </div>
      {scene.cards.map((card, ci) => {
        const items = (card.params as { items?: { at?: number; name?: string; label?: string }[] }).items;
        return (
          <div key={ci} className="card flex flex-col gap-2 px-4 py-3">
            <span className="meta font-mono">{card.type}</span>
            {editableParams(card).map((p) => (
              <label key={p.key} className="field">
                <span className="meta font-mono">{p.key}</span>
                <input
                  aria-label={p.key}
                  type={p.kind === 'number' ? 'number' : 'text'}
                  value={String(card.params[p.key])}
                  onChange={(e) => onEdit({ op: 'card-param', scene: scene.id, card: ci, key: p.key, value: p.kind === 'number' ? num(e.target.value) : e.target.value })}
                />
              </label>
            ))}
            <div className="flex gap-2">
              <label className="field">
                <span className="meta font-mono">{d.start}</span>
                <input type="number" step={0.01} value={card.start} onChange={(e) => onEdit({ op: 'card-time', scene: scene.id, card: ci, start: num(e.target.value), end: card.end })} />
              </label>
              <label className="field">
                <span className="meta font-mono">{d.end}</span>
                <input type="number" step={0.01} value={card.end} onChange={(e) => onEdit({ op: 'card-time', scene: scene.id, card: ci, start: card.start, end: num(e.target.value) })} />
              </label>
            </div>
            {Array.isArray(items) &&
              items.map((it, ii) =>
                typeof it.at === 'number' ? (
                  <label key={ii} className="field">
                    <span className="meta font-mono">{it.name ?? it.label ?? ii + 1}</span>
                    <input type="number" step={0.01} value={it.at} onChange={(e) => onEdit({ op: 'item-at', scene: scene.id, card: ci, item: ii, at: num(e.target.value) })} />
                  </label>
                ) : null,
              )}
          </div>
        );
      })}
      {cues.length > 0 && (
        <div className="card flex flex-col gap-2 px-4 py-3">
          <span className="meta font-mono">{d.sounds}</span>
          {cues.map(({ c, i }) => (
            <div key={i} className="flex items-center gap-2">
              <span className="meta flex-1 truncate font-mono">{c.file.replace(/^sfx\//, '')}</span>
              <input aria-label={`${d.at} ${i}`} className="w-20" type="number" step={0.01} value={c.at} onChange={(e) => onEdit({ op: 'sfx', index: i, at: num(e.target.value) })} />
              <input aria-label={`${d.volume} ${i}`} className="w-16" type="number" step={0.05} value={c.volume} onChange={(e) => onEdit({ op: 'sfx', index: i, volume: num(e.target.value) })} />
            </div>
          ))}
        </div>
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
