'use client';

import { t, type Language } from '@/lib/i18n';
import type { Candidate } from '@/lib/app/music';
import type { MusicPick as Picked } from '@/lib/app/workspace/schema';

/**
 * Claude's 3–4 track suggestions (spec §6 "Music"): title, reason, licence, a Content ID badge and a link to listen.
 * The app never downloads from those links; once a track is picked, the user drops the downloaded file in.
 */
export function MusicPick({
  lang,
  candidates,
  picked,
  onPick,
  onUpload,
  onMore,
}: {
  lang: Language;
  candidates: Candidate[];
  picked: Picked | null;
  onPick: (i: number) => void;
  onUpload: (f: File) => void;
  onMore: () => void;
}) {
  const d = t(lang).music;
  return (
    <div className="flex flex-col gap-4">
      <span className="font-px text-xl">{d.title}</span>
      <div className="flex flex-col gap-2">
        {candidates.map((c, i) => {
          const on = picked?.url === c.url;
          return (
            <div key={c.url} className={`card flex items-center gap-4 px-5 py-3${on ? ' ring-2' : ''}`} style={on ? { borderColor: 'var(--brand-d)' } : undefined}>
              <div className="flex flex-1 flex-col">
                <a href={c.url} target="_blank" rel="noreferrer noopener" className="font-bold">
                  {c.title} ↗
                </a>
                <span className="meta">{c.why}</span>
              </div>
              <span className="meta font-mono">{c.license}</span>
              {c.contentId && <span className="badge font-mono">Content ID</span>}
              <button type="button" className={on ? 'btn btn-primary' : 'btn'} onClick={() => onPick(i)}>
                {d.pick}
              </button>
            </div>
          );
        })}
      </div>
      <div>
        <button type="button" className="btn" onClick={onMore}>
          {d.more}
        </button>
      </div>
      {picked && (
        <label className="dropzone flex flex-col items-center gap-2 px-6 py-8">
          <span>{d.drop}</span>
          <span className="meta">{picked.file ?? picked.title}</span>
          <input
            type="file"
            accept=".mp3,.wav,.m4a,.ogg,.flac,audio/*"
            aria-label={d.drop}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
            }}
          />
        </label>
      )}
    </div>
  );
}
