'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { TranscriptEditor } from '@/components/TranscriptEditor';
import type { Language } from '@/lib/i18n';
import type { Transcript } from '@/lib/app/transcript';

export function TranscriptClient({ lang, projectId, transcript }: { lang: Language; projectId: string; transcript: Transcript }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function save(words: string[]) {
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/transcript`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ words }) });
    if (!res.ok) return setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? res.statusText);
    router.refresh();
  }
  return (
    <>
      <TranscriptEditor lang={lang} transcript={transcript} onSave={save} />
      {error && <p className="font-mono text-sm" style={{ color: '#e5484d' }}>{error}</p>}
    </>
  );
}
