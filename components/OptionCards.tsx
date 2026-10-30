'use client';

import { px } from '@/lib/i18n/px';
import { useState } from 'react';
import { t, type Language } from '@/lib/i18n';
import { RATIOS, type Ratio, type Selection } from '@/lib/plan/schema';
import type { Preset } from '@/lib/app/workspace/schema';
import { GROUPS, isOn, tilesFor, toggle } from '@/lib/app/cards/catalogue';
import { PREVIEWS } from './card-previews';

export type CardsChoice = { selection: Selection; ratios: Ratio[]; references: string[] };

const ORDER: Ratio[] = ['9:16', '4:5', '1:1', '16:9'];

/** "Editini kur" / "Build your edit": six fixed tiles per row, ratios and reference reels, then confirm. */
export function OptionCards({
  lang,
  preset,
  selection,
  ratios,
  references,
  onConfirm,
  confirmLabel,
  showRatios = false,
}: {
  lang: Language;
  preset: Preset;
  selection: Selection;
  ratios: Ratio[];
  references: string[];
  onConfirm: (c: CardsChoice) => void;
  confirmLabel?: string;
  /** Ratios are picked when the project is created; only the later "change cards" screen offers them again. */
  showRatios?: boolean;
}) {
  const d = t(lang).cards;
  const [sel, setSel] = useState(selection);
  const [rs, setRs] = useState<Ratio[]>(ratios);
  const [refs, setRefs] = useState(references.join('\n'));
  const tiles = tilesFor(preset);
  const count = tiles.filter((x) => isOn(sel, x)).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <span className="font-px text-xl">{px(d.title)}</span>
        <span className="flex-1" />
        <span className="font-mono text-xs" style={{ color: 'var(--brand-d)' }}>
          {count} {d.selected}
        </span>
      </div>
      {GROUPS.map((g) => {
        const gt = tiles.filter((x) => x.group === g);
        if (!gt.length) return null;
        return (
          <section key={g}>
            <div className="oc-group">{d.groups[g]}</div>
            <div className="oc-grid" style={{ gridTemplateColumns: 'repeat(6, 132px)' }}>
              {gt.map((x) => {
                const on = isOn(sel, x);
                const item = d.items[x.id];
                return (
                  <button key={x.id} type="button" className={`oc${on ? ' on' : ''}`} aria-pressed={on} title={item.desc} onClick={() => setSel((s) => toggle(s, x))}>
                    <span className="ck" aria-hidden>✓</span>
                    <span className="pv" aria-hidden>{PREVIEWS[x.id]}</span>
                    <span className="nm">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      {showRatios && (
        <>
          <div className="oc-group">{d.ratios}</div>
          <div className="flex gap-4 font-mono text-sm">
            {ORDER.filter((r) => RATIOS.includes(r)).map((r) => (
              <label key={r} className="flex items-center gap-2">
                <input type="checkbox" checked={rs.includes(r)} onChange={() => setRs((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : ORDER.filter((x) => x === r || cur.includes(x))))} />
                {r}
              </label>
            ))}
          </div>
        </>
      )}
      <label className="oc-group" htmlFor="oc-refs">{d.references}</label>
      <textarea id="oc-refs" className="card px-4 py-3 font-mono text-sm" rows={2} value={refs} onChange={(e) => setRefs(e.target.value)} />
      <div className="pt-4">
        <button
          type="button"
          className="btn btn-primary"
          disabled={rs.length === 0}
          onClick={() => onConfirm({ selection: sel, ratios: rs, references: refs.split('\n').map((x) => x.trim()).filter(Boolean) })}
        >
          {confirmLabel ?? d.confirm}
        </button>
      </div>
    </div>
  );
}
