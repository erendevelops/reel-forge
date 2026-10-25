'use client';

import type { Language } from '@/lib/i18n';

const LANGS: Language[] = ['tr', 'en'];

export function LanguageSwitch({ lang, onChange }: { lang: Language; onChange: (l: Language) => void }) {
  return (
    <span className="lang-switch">
      {LANGS.map((l, i) => (
        <span key={l}>
          {i > 0 && <span className="lang-sep"> / </span>}
          <button
            type="button"
            aria-current={l === lang ? 'true' : undefined}
            onClick={() => onChange(l)}
          >
            {l.toUpperCase()}
          </button>
        </span>
      ))}
    </span>
  );
}
