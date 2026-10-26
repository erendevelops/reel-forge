'use client';

import type { ReactNode } from 'react';
import { t, type Language } from '@/lib/i18n';
import { LanguageSwitch } from './LanguageSwitch';

export function TopBar({
  lang,
  onLanguageChange,
  right,
}: {
  lang: Language;
  onLanguageChange: (l: Language) => void;
  right?: ReactNode;
}) {
  const d = t(lang);
  return (
    <header className="topbar">
      <a href="/projects" className="topbar-brand">
        <span className="topbar-logo">▶</span>
        <span className="font-px">{d.brand}</span>
      </a>
      <nav className="topbar-nav font-mono">
        <a href="/projects">{d.nav.projects}</a>
        <a href="/setup">{d.nav.setup}</a>
        <a href="/settings">{d.nav.settings}</a>
      </nav>
      <span className="topbar-spacer" />
      <LanguageSwitch lang={lang} onChange={onLanguageChange} />
      {right}
    </header>
  );
}
