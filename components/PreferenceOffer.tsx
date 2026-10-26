'use client';

import { t, type Language } from '@/lib/i18n';

/** Claude proposed a lasting preference; the user keeps it for next projects or dismisses it (spec §9). */
export function PreferenceOffer({ lang, text, projectId, onDone }: { lang: Language; text: string; projectId: string; onDone: () => void }) {
  const d = t(lang).settings;
  return (
    <div className="card flex flex-col gap-2 px-4 py-3" style={{ borderColor: 'var(--brand)' }}>
      <span className="meta text-xs">{d.offer}</span>
      <b>{text}</b>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-primary"
          onClick={async () => {
            await fetch('/api/preferences', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, source: projectId }) });
            onDone();
          }}
        >
          {d.savePreference}
        </button>
        <button type="button" className="btn" onClick={onDone}>
          {d.dismiss}
        </button>
      </div>
    </div>
  );
}
