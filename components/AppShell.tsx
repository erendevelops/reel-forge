'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Language } from '@/lib/i18n';
import { TopBar } from './TopBar';

/** Client wrapper so the language switch can persist the choice and re-render server pages. */
export function AppShell({ lang, children }: { lang: Language; children: ReactNode }) {
  const router = useRouter();
  async function change(next: Language) {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ language: next }),
    });
    router.refresh();
  }
  return (
    <>
      <TopBar lang={lang} onLanguageChange={change} />
      <main className="page">{children}</main>
    </>
  );
}
