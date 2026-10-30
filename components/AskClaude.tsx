'use client';

import { useState } from 'react';
import { t, type Language } from '@/lib/i18n';

/** "Ask Claude": one line, scoped to the selected scene (`[scene <id>] …`) or the whole video. */
export function AskClaude({ lang, sceneId, onSend }: { lang: Language; sceneId: string | null; onSend: (request: string) => void }) {
  const d = t(lang).storyboard;
  const [text, setText] = useState('');
  const [whole, setWhole] = useState(false);
  function send() {
    const v = text.trim();
    if (!v) return;
    onSend(whole || !sceneId ? v : `[scene ${sceneId}] ${v}`);
    setText('');
  }
  return (
    <form
      className="ask flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <input
        className="card px-4 py-3"
        aria-label={d.ask}
        placeholder={`${d.ask}…`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            send();
          }
        }}
      />
      <div className="flex items-center gap-3 font-mono text-xs">
        <label className="flex items-center gap-1">
          <input type="radio" checked={!whole} onChange={() => setWhole(false)} disabled={!sceneId} /> {d.askScene}
        </label>
        <label className="flex items-center gap-1">
          <input type="radio" checked={whole} onChange={() => setWhole(true)} /> {d.askAll}
        </label>
        <button type="submit" className="btn ml-auto" disabled={!text.trim()}>
          {d.send}
        </button>
      </div>
    </form>
  );
}
