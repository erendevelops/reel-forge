'use client';

import { t, type Language } from '@/lib/i18n';
import type { Check } from '@/lib/app/setup/checks';

export function SetupList({
  lang,
  checks,
  onRecheck,
  onDownloadFaceModel,
  busy = false,
}: {
  lang: Language;
  checks: Check[];
  onRecheck: () => void;
  onDownloadFaceModel: () => void;
  busy?: boolean;
}) {
  const d = t(lang).setup;
  return (
    <div className="flex flex-col gap-3">
      {checks.map((c) => (
        <div key={c.id} className="card flex items-center gap-4 px-5 py-4">
          <span
            aria-label={c.ok ? 'ok' : 'fail'}
            className="grid h-7 w-7 place-items-center rounded-lg text-white"
            style={{ background: c.ok ? 'var(--brand-d)' : '#e5484d' }}
          >
            {c.ok ? '✓' : '!'}
          </span>
          <div className="flex-1">
            <div className="font-semibold">{d.checks[c.id]}</div>
            <div className="meta">{c.detail}</div>
          </div>
          {!c.ok && c.id === 'face-model' && (
            <button type="button" className="btn btn-primary" onClick={onDownloadFaceModel} disabled={busy}>
              {d.downloadFaceModel}
            </button>
          )}
          {!c.ok && c.id !== 'face-model' && c.fix && (
            <span className="flex items-center gap-2">
              <code className="font-mono rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--soft)' }}>
                {c.fix}
              </code>
              <button type="button" className="btn" onClick={() => void navigator.clipboard?.writeText(c.fix ?? '')}>
                {d.copy}
              </button>
            </span>
          )}
        </div>
      ))}
      <div>
        <button type="button" className="btn" onClick={onRecheck} disabled={busy}>
          {d.recheck}
        </button>
      </div>
    </div>
  );
}
