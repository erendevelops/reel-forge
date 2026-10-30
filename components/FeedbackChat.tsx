'use client';

import { useEffect, useRef, useState } from 'react';
import { t, type Language } from '@/lib/i18n';
import type { ChatMessage } from '@/lib/app/feedback';
import { Spinner } from './Spinner';

/**
 * The feedback chat (one thread per project): write everything you want changed, Claude rebuilds the whole video
 * from all the feedback so far and answers point by point. Enter sends, Shift+Enter starts a new line.
 */
export function FeedbackChat({ lang, projectId, running, onSend }: { lang: Language; projectId: string; running: boolean; onSend: (text: string) => Promise<void> | void }) {
  const d = t(lang).chat;
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/feedback`)
      .then((r) => r.json())
      .then((j: { messages?: ChatMessage[] }) => setMessages(j.messages ?? []))
      .catch(() => setMessages([]));
  }, [projectId, running]);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'nearest' });
  }, [messages]);

  async function send() {
    const v = text.trim();
    if (!v || running || sending) return;
    setSending(true);
    try {
      await onSend(v);
      setMessages((m) => [...(m ?? []), { role: 'user', text: v, at: new Date().toISOString(), version: null, failed: false }]);
      setText('');
    } finally {
      setSending(false);
    }
  }

  const waiting = running && messages?.at(-1)?.role === 'user';
  return (
    <div className="card flex flex-col gap-3 px-4 py-4">
      <span className="meta uppercase tracking-widest">{d.title}</span>
      <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
        {messages === null ? (
          <Spinner />
        ) : messages.length === 0 ? (
          <p className="meta">{d.empty}</p>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'self-end' : 'self-start'}`}
              style={{ maxWidth: '90%', background: m.role === 'user' ? '#e3f4ec' : m.failed ? '#fdecec' : '#f3f1ea' }}
            >
              {m.text}
              {m.role === 'claude' && m.version && <div className="meta mt-1 font-mono text-xs">→ v{m.version}</div>}
            </div>
          ))
        )}
        {waiting && <Spinner label={d.working} />}
        <div ref={end} />
      </div>
      <textarea
        className="card px-3 py-2"
        rows={4}
        aria-label={d.title}
        placeholder={d.placeholder}
        value={text}
        disabled={running}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void send();
          }
        }}
      />
      <button type="button" className="btn btn-primary" disabled={!text.trim() || running || sending} onClick={() => void send()}>
        {d.send}
      </button>
      <span className="meta text-xs">{d.hint}</span>
    </div>
  );
}
