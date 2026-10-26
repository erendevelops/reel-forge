'use client';

import { t, type Language } from '@/lib/i18n';
import type { VersionOrigin } from '@/lib/app/workspace/schema';

/** Which version the storyboard shows; Claude's versions carry their request, the user's a ✎. */
export function VersionPicker({ lang, versions, value, onChange }: { lang: Language; versions: VersionOrigin[]; value: number; onChange: (n: number) => void }) {
  const d = t(lang).storyboard;
  return (
    <label className="flex items-center gap-2 font-mono text-xs">
      <span className="meta">{d.version}</span>
      <select className="card px-2 py-1" value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {versions.map((v) => (
          <option key={v.n} value={v.n}>
            v{v.n} · {v.by === 'user' ? '✎' : (v.request ?? 'claude').slice(0, 40)}
          </option>
        ))}
      </select>
    </label>
  );
}
