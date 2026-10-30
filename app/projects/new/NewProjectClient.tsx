'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { NewProjectForm, type NewProjectInput } from '@/components/NewProjectForm';
import type { ImportFile } from '@/components/FileImport';
import { t, type Language } from '@/lib/i18n';

/** One file streamed to the project's inputs/, reporting bytes sent (fetch can't report upload progress). */
function upload(id: string, f: ImportFile, onBytes: (n: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `/api/projects/${id}/inputs?path=${encodeURIComponent(f.rel)}`);
    xhr.upload.onprogress = (e) => onBytes(e.loaded);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`${f.rel}: ${xhr.status} ${xhr.responseText}`)));
    xhr.onerror = () => reject(new Error(`${f.rel}: upload failed`));
    xhr.send(f.file);
  });
}

export function NewProjectClient({ lang }: { lang: Language }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  async function create(input: NewProjectInput, files: ImportFile[]) {
    setError(null);
    const res = await fetch('/api/projects', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
    const body = await res.json();
    if (!res.ok) return setError(typeof body.error === 'string' ? body.error : JSON.stringify(body.error));
    const total = files.reduce((s, f) => s + f.file.size, 0) || 1;
    let done = 0;
    try {
      for (const f of files) {
        setProgress(done / total);
        await upload(body.id, f, (n) => setProgress((done + n) / total));
        done += f.file.size;
      }
    } catch (e) {
      setProgress(null);
      return setError((e as Error).message);
    }
    router.push(`/projects/${body.id}`);
  }
  return (
    <>
      <NewProjectForm lang={lang} onSubmit={create} />
      {progress !== null && (
        <div className="flex items-center gap-3">
          <div className="progress flex-1">
            <div style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <span className="meta font-mono text-xs">{t(lang).newProject.uploading.replace('{pct}', String(Math.round(progress * 100)))}</span>
        </div>
      )}
      {error && <p className="font-mono text-sm" style={{ color: '#e5484d' }}>{error}</p>}
    </>
  );
}
