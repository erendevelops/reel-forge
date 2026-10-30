'use client';

import { Fragment, type ReactNode } from 'react';
import { t, type Language } from '@/lib/i18n';
import type { CardType, Plan } from '@/lib/plan/schema';

const ICON: Record<CardType, string> = {
  'title-card': 'T', 'numbered-list': '≡', 'bar-chart': '▤', checklist: '✓', stamp: '◉', 'typed-title': '⌨',
  'logo-pop': '★', 'custom-animation': '✦', 'rolling-number': '#', 'follow-outro': '＋',
};

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** `say` with the names that appear on the scene's cards in bold (product names, numbers). */
function Say({ text, names }: { text: string; names: string[] }) {
  if (!names.length) return <>{text}</>;
  const re = new RegExp(`(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return (
    <>
      {text.split(re).map((part, i) => (names.some((n) => n.toLowerCase() === part.toLowerCase()) ? <b key={i}>{part}</b> : <Fragment key={i}>{part}</Fragment>))}
    </>
  );
}

/** One airy line per scene: number and time, what's said, small card icons (♪ when a sound lands in it), duration. */
/** `detail`: the selected scene's panel, opened right under its row. */
export function SceneList({ lang, plan, selected, current, onSelect, detail }: { lang: Language; plan: Plan; selected: string; current: string | null; onSelect: (id: string) => void; detail?: ReactNode }) {
  const d = t(lang).storyboard;
  return (
    <ul className="flex flex-col gap-2">
      {plan.scenes.map((s, i) => {
        const names = s.cards.flatMap((c) => ['name', 'text'].map((k) => c.params[k]).filter((v): v is string => typeof v === 'string' && v.length > 1));
        const sound = plan.sfx.some((c) => c.at >= s.start && c.at < s.end);
        const icons = [...new Set(s.cards.map((c) => ICON[c.type]))];
        return (
          <li key={s.id}>
            <button
              type="button"
              className={`scene-row${s.id === selected ? ' sel' : ''}${s.id === current ? ' now' : ''}`}
              onClick={() => onSelect(s.id)}
            >
              <span className="meta font-mono">{`${String(i + 1).padStart(2, '0')} · ${clock(s.start)}`}</span>
              <span className="scene-say">
                <Say text={s.say || s.why} names={names} />
              </span>
              <span className="scene-ic font-mono">
                {icons.map((x) => (
                  <span key={x}>{x}</span>
                ))}
                {sound && <span>♪</span>}
              </span>
              <span className="meta font-mono">
                {(s.end - s.start).toFixed(1)} {d.seconds}
              </span>
            </button>
            {s.id === selected && detail && <div className="scene-detail">{detail}</div>}
          </li>
        );
      })}
    </ul>
  );
}
