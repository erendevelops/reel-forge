'use client';

import { px } from '@/lib/i18n/px';
import { useState } from 'react';
import { t as dict, type Language } from '@/lib/i18n';
import { lines, type Transcript } from '@/lib/app/transcript';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Whisper's words as chips, one line per sentence or pause; a click turns a chip into an input. Timings never change. */
export function TranscriptEditor({ lang, transcript, onSave }: { lang: Language; transcript: Transcript; onSave: (words: string[]) => void }) {
  const d = dict(lang).transcript;
  const [words, setWords] = useState(transcript.words.map((w) => w.w));
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  function commit() {
    if (editing === null) return;
    const v = draft.trim();
    if (v) setWords((ws) => ws.map((w, i) => (i === editing ? v : w)));
    setEditing(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-4">
        <span className="font-px text-xl">{px(d.title)}</span>
        <span className="meta">{d.hint}</span>
      </div>
      <div className="card flex flex-col gap-3 px-6 py-5">
        {lines(transcript).map((line) => (
          <div key={line[0]} className="flex flex-wrap items-baseline gap-1.5">
            <span className="meta w-12 shrink-0 font-mono">{clock(transcript.words[line[0]].start)}</span>
            {line.map((i) =>
              editing === i ? (
                <input
                  key={i}
                  autoFocus
                  className="tr-chip tr-input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commit();
                    if (e.key === 'Escape') setEditing(null);
                  }}
                />
              ) : (
                <button
                  key={i}
                  type="button"
                  className={`tr-chip${words[i] !== transcript.words[i].w ? ' edited' : ''}`}
                  onClick={() => {
                    setEditing(i);
                    setDraft(words[i]);
                  }}
                >
                  {words[i]}
                </button>
              ),
            )}
          </div>
        ))}
      </div>
      <div>
        <button type="button" className="btn btn-primary" onClick={() => onSave(words)}>
          {d.confirm}
        </button>
      </div>
    </div>
  );
}
