'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { NewProjectForm, type NewProjectInput } from '@/components/NewProjectForm';
import type { Language } from '@/lib/i18n';

export function NewProjectClient({ lang }: { lang: Language }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function create(input: NewProjectInput) {
    const res = await fetch('/api/projects', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
    const body = await res.json();
    if (!res.ok) return setError(typeof body.error === 'string' ? body.error : JSON.stringify(body.error));
    router.push(`/projects/${body.id}`);
  }
  return (
    <>
      <NewProjectForm lang={lang} onSubmit={create} />
      {error && <p className="font-mono text-sm" style={{ color: '#e5484d' }}>{error}</p>}
    </>
  );
}
