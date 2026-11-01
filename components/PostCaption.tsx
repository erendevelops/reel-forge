'use client';

import { useState } from 'react';
import { t, type Language } from '@/lib/i18n';
import type { Plan } from '@/lib/plan';

/** The post text Claude wrote for the video (caption + hashtags), ready to copy into Instagram/TikTok. */
export function PostCaption({ lang, post }: { lang: Language; post: NonNullable<Plan['post']> }) {
  const d = t(lang).review;
  const [copied, setCopied] = useState(false);
  const text = [post.caption, post.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')].filter(Boolean).join('\n\n');
  async function copy() {
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <section className="card flex flex-col gap-3 p-5">
      <div className="flex items-center gap-3">
        <span className="meta uppercase tracking-widest">{d.postTitle}</span>
        <span className="flex-1" />
        <button type="button" className="btn" onClick={() => void copy()}>
          {copied ? d.copied : d.copy}
        </button>
      </div>
      <p className="whitespace-pre-wrap text-sm">{text}</p>
    </section>
  );
}
