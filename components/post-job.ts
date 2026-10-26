import { t, type Language } from '@/lib/i18n';

/** Starts a job from the UI. A busy project (409) becomes the localised busy message instead of a raw error. */
export async function postJob(url: string, body: object, lang: Language): Promise<{ jobId: string } | { error: string }> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  if (res.status === 409) return { error: t(lang).common.busy };
  if (!res.ok) return { error: typeof out.error === 'string' ? out.error : JSON.stringify(out.error ?? res.statusText) };
  return { jobId: out.jobId };
}
