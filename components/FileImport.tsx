'use client';

import { useState } from 'react';
import { t, type Language } from '@/lib/i18n';
import { isSkipped } from '@/lib/app/upload';

/** A file to import with its path relative to what the user picked ("çekimler/klip 1.mp4"). */
export type ImportFile = { file: File; rel: string };

type Entry = { isFile: boolean; isDirectory: boolean; name: string; fullPath: string };
type FileEntry = Entry & { file: (ok: (f: File) => void, fail: (e: unknown) => void) => void };
type DirEntry = Entry & { createReader: () => { readEntries: (ok: (es: Entry[]) => void, fail: (e: unknown) => void) => void } };

/** Every file under a dropped entry, skipping dependency/build folders without descending into them. */
async function walk(entry: Entry): Promise<ImportFile[]> {
  const rel = entry.fullPath.replace(/^\/+/, '');
  if (isSkipped(rel)) return [];
  if (entry.isFile) {
    const file = await new Promise<File>((ok, fail) => (entry as FileEntry).file(ok, fail));
    return [{ file, rel }];
  }
  const reader = (entry as DirEntry).createReader();
  const out: ImportFile[] = [];
  // readEntries returns batches until an empty one
  for (;;) {
    const batch = await new Promise<Entry[]>((ok, fail) => reader.readEntries(ok, fail));
    if (!batch.length) break;
    for (const e of batch) out.push(...(await walk(e)));
  }
  return out;
}

const mb = (n: number) => (n / 1024 / 1024).toFixed(n > 100 * 1024 * 1024 ? 0 : 1);

/** Drop zone plus "pick files" / "pick folder": the footage, voice-over or app folder to import into the project. */
export function FileImport({ lang, files, onChange }: { lang: Language; files: ImportFile[]; onChange: (f: ImportFile[]) => void }) {
  const d = t(lang).newProject;
  const [over, setOver] = useState(false);
  const add = (more: ImportFile[]) => {
    const seen = new Set(files.map((f) => f.rel));
    onChange([...files, ...more.filter((f) => !seen.has(f.rel) && !isSkipped(f.rel))]);
  };
  const fromInput = (list: FileList | null) => add([...(list ?? [])].map((file) => ({ file, rel: file.webkitRelativePath || file.name })));
  const total = files.reduce((s, f) => s + f.file.size, 0);

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`dropzone flex flex-col items-center gap-3 px-6 py-8${over ? ' over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setOver(false);
          const entries = [...e.dataTransfer.items].map((i) => (i as DataTransferItem & { webkitGetAsEntry?: () => Entry | null }).webkitGetAsEntry?.()).filter(Boolean) as Entry[];
          if (entries.length) add((await Promise.all(entries.map(walk))).flat());
          else fromInput(e.dataTransfer.files);
        }}
      >
        <span>{d.drop}</span>
        <div className="flex gap-2">
          <label className="btn">
            {d.pickFiles}
            <input type="file" multiple className="sr-only" aria-label={d.pickFiles} onChange={(e) => fromInput(e.target.files)} />
          </label>
          <label className="btn">
            {d.pickFolder}
            <input type="file" className="sr-only" aria-label={d.pickFolder} onChange={(e) => fromInput(e.target.files)} {...{ webkitdirectory: '', directory: '' }} />
          </label>
        </div>
      </div>
      {files.length > 0 && (
        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="meta">{d.picked.replace('{n}', String(files.length)).replace('{mb}', mb(total))}</span>
          <button type="button" className="btn" onClick={() => onChange([])}>
            {d.clear}
          </button>
        </div>
      )}
    </div>
  );
}
