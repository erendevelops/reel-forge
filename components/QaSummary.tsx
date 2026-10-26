'use client';

import { t, type Language } from '@/lib/i18n';
import type { QaReport } from '@/lib/render/qa';

/** One row per QA gate (spec §12) with ✓/✗ and what was measured; a failure offers "ask Claude to fix". */
export function QaSummary({ lang, reports, onFix }: { lang: Language; reports: Record<string, QaReport>; onFix: (request: string) => void }) {
  const d = t(lang).review;
  const entries = Object.entries(reports);
  if (!entries.length) return null;
  return (
    <div className="card flex flex-col gap-2 px-5 py-4">
      <span className="meta font-mono">{d.qa}</span>
      {entries.map(([name, r]) => (
        <div key={name} className="flex flex-col gap-1">
          {entries.length > 1 && <span className="meta font-mono text-xs">{name}</span>}
          <ul className="flex flex-col gap-1">
            {r.checks.map((c) => (
              <li key={c.name} className="flex items-baseline gap-3">
                <span style={{ color: c.pass ? 'var(--brand-d)' : '#e5484d' }}>{c.pass ? '✓' : '✗'}</span>
                <span className="font-mono text-sm">{c.name}</span>
                <span className="meta flex-1 truncate text-xs">{c.detail}</span>
              </li>
            ))}
          </ul>
          {!r.pass && (
            <div>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  onFix(
                    `QA failed (${name}): ${r.checks
                      .filter((c) => !c.pass)
                      .map((c) => `${c.name} ${c.detail}`)
                      .join('; ')}. Fix the plan so the next render passes.`,
                  )
                }
              >
                {d.fix}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
