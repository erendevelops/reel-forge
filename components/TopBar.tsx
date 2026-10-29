'use client';

import Link from 'next/link';
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
      <Link href="/projects" className="topbar-brand">
        <span className="topbar-logo">▶</span>
        <span className="font-px">{d.brand}</span>
      </Link>
      <nav className="topbar-nav font-mono">
        <Link href="/projects">{d.nav.projects}</Link>
        <Link href="/setup">{d.nav.setup}</Link>
        <Link href="/settings">{d.nav.settings}</Link>
      </nav>
      <span className="topbar-spacer" />
      <LanguageSwitch lang={lang} onChange={onLanguageChange} />
      {right}
    </header>
  );
}
