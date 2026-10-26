'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { t, type Language } from '@/lib/i18n';
import type { Preferences } from '@/lib/app/workspace/schema';

const json = (method: string, url: string, body: unknown) => fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

/** Settings (spec §11 screen 8): language, learned preferences (edit inline, remove), Claude path, workspace folder. */
export function SettingsClient({ lang, rules, claudeBinary, workspace }: { lang: Language; rules: Preferences['rules']; claudeBinary: string; workspace: string }) {
  const d = t(lang).settings;
  const router = useRouter();
  const [list, setList] = useState(rules.map((r) => r.text));
  const [binary, setBinary] = useState(claudeBinary);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <section className="flex items-center gap-4">
        <span className="meta font-mono">{d.language}</span>
        <LanguageSwitch
          lang={lang}
          onChange={async (l) => {
            await json('POST', '/api/settings', { language: l });
            router.refresh();
          }}
        />
      </section>

      <section className="flex flex-col gap-2">
        <span className="meta font-mono">{d.preferences}</span>
        {list.length === 0 && <p className="meta">{d.none}</p>}
        {list.map((text, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className="card flex-1 px-4 py-2"
              aria-label={`${d.preferences} ${i + 1}`}
              value={text}
              onChange={(e) => setList((l) => l.map((x, j) => (j === i ? e.target.value : x)))}
              onBlur={() => {
                if (text.trim() && text !== rules[i]?.text) void json('PATCH', '/api/preferences', { index: i, text });
              }}
            />
            <button
              type="button"
              className="btn"
              onClick={async () => {
                await json('DELETE', '/api/preferences', { index: i });
                setList((l) => l.filter((_, j) => j !== i));
                router.refresh();
              }}
            >
              {d.remove}
            </button>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <label className="meta font-mono" htmlFor="claude-bin">
          {d.claude}
        </label>
        <input
          id="claude-bin"
          className="card px-4 py-2 font-mono text-sm"
          value={binary}
          onChange={(e) => setBinary(e.target.value)}
          onBlur={() => {
            if (binary.trim() && binary !== claudeBinary) void json('POST', '/api/settings', { claudeBinary: binary.trim() });
          }}
        />
      </section>

      <section className="flex items-center gap-3">
        <span className="meta font-mono">{d.workspace}</span>
        <code className="font-mono text-sm">{workspace}</code>
        <button type="button" className="btn" onClick={() => void navigator.clipboard?.writeText(workspace)}>
          {d.copy}
        </button>
      </section>
    </div>
  );
}
