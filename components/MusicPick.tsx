'use client';

import { px } from '@/lib/i18n/px';
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
      <span className="font-px text-xl">{px(d.title)}</span>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {candidates.map((c, i) => {
          const on = picked?.url === c.url;
          return (
            <div key={c.url} className={`music-card card flex flex-col gap-3 px-5 py-4${on ? ' on' : ''}`}>
              <div className="flex items-start gap-3">
                <span className="music-ic" aria-hidden>
                  ♪
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <a href={c.url} target="_blank" rel="noreferrer noopener" className="font-bold leading-snug">
                    {c.title} <span className="meta">↗</span>
                  </a>
                  {c.artist && <span className="meta text-xs">{c.artist}</span>}
                </div>
                <button type="button" className={on ? 'btn btn-primary shrink-0' : 'btn shrink-0'} onClick={() => onPick(i)}>
                  {on ? '✓' : d.pick}
                </button>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--ink)' }}>
                {c.why}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge font-mono">{c.license.replace(/\s*\(.*\)\s*$/, '')}</span>
                {c.contentId && <span className="badge badge-warn font-mono">Content ID</span>}
              </div>
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
