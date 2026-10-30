import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { ReviewClient } from '../../app/projects/[id]/ReviewClient';
import { tr } from '../../lib/i18n/tr';
import type { Plan } from '../../lib/plan';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const v5 = (): Plan => JSON.parse(readFileSync('tests/fixtures/plan-reel-v5.json', 'utf8'));
const versions = [
  { n: 1, by: 'claude' as const, parent: null, request: 'first cut', diff: null, createdAt: '' },
  { n: 2, by: 'user' as const, parent: 1, request: null, diff: null, createdAt: '' },
];
const qaFail = { pass: false, checks: [{ name: 'format', pass: true, detail: '{"fps":30}' }, { name: 'loudness', pass: false, detail: 'I=-16.2 LUFS (target -14 ±1), TP=-2 dBTP (max -1.5)' }] };

let calls: { url: string; body: unknown }[];
beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
      const m = /versions\/(\d+)$/.exec(url);
      if (m) {
        const n = Number(m[1]);
        const plan = v5();
        if (n === 2) plan.scenes[1].cards[0].params.name = 'Fooocus AI';
        return new Response(JSON.stringify({ plan, origin: versions[n - 1], renders: [{ ratio: '9:16', profile: 'final', url: `/f/v${n}.mp4` }], qa: { 'final-9x16': qaFail }, thumbs: [] }));
      }
      if (url.endsWith('/feedback')) {
        const asked = calls.filter((c) => c.url.endsWith('/claude')).map((c) => ({ role: 'user', text: (c.body as { request: string }).request, at: '', version: null, failed: false }));
        return new Response(JSON.stringify({ messages: asked }));
      }
      return new Response(JSON.stringify({ jobId: 'job-9' }), { status: 201 });
    }),
  );
  vi.stubGlobal('EventSource', class { onmessage = null; onerror = null; close() {} });
});
afterEach(() => vi.unstubAllGlobals());

describe('ReviewClient', () => {
  it('shows QA per gate and asks Claude to fix a failure with the measured value', async () => {
    render(<ReviewClient lang="tr" projectId="p1" projectName="Prao" versions={versions} current={2} lastJobId={null} />);
    await waitFor(() => expect(screen.getByText('loudness')).toBeTruthy());
    expect(screen.getByText('loudness').closest('li')!.textContent).toContain('✗');
    expect(screen.getByText('format').closest('li')!.textContent).toContain('✓');
    await userEvent.click(screen.getByRole('button', { name: tr.review.fix }));
    const sent = calls.find((c) => c.url.endsWith('/claude'))!;
    expect((sent.body as { stage: string }).stage).toBe('revise');
    expect((sent.body as { request: string }).request).toMatch(/loudness/);
    expect((sent.body as { request: string }).request).toContain('-16.2');
  });

  it('compares the current version with its parent and plays both together', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const { container } = render(<ReviewClient lang="tr" projectId="p1" projectName="Prao" versions={versions} current={2} lastJobId={null} />);
    await waitFor(() => expect(screen.getByText('scenes[1].cards[0].params.name')).toBeTruthy());
    expect(container.querySelectorAll('.compare video')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: tr.review.playBoth }));
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('ends with a finish card and a download for the final video', async () => {
    render(<ReviewClient lang="tr" projectId="p1" projectName="Prao" versions={versions} current={2} lastJobId={null} />);
    await waitFor(() => expect(screen.getByText(tr.review.readyTitle)).toBeTruthy());
    const dl = screen.getByRole('link', { name: /İndir · 9:16 dikey/ });
    expect(dl.getAttribute('href')).toBe('/f/v2.mp4');
    expect(dl.getAttribute('download')).toBe('Prao-9x16.mp4');
  });

  it('sends feedback from the chat as a rebuild request and shows it in the thread', async () => {
    render(<ReviewClient lang="tr" projectId="p1" projectName="Prao" versions={versions} current={2} lastJobId={null} />);
    await userEvent.type(screen.getByRole('textbox', { name: tr.chat.title }), 'müzik çok yüksek');
    await userEvent.click(screen.getByRole('button', { name: tr.chat.send }));
    const sent = calls.find((c) => c.url.endsWith('/claude'))!;
    expect(sent.body).toEqual({ stage: 'rebuild', request: 'müzik çok yüksek' });
    await waitFor(() => expect(screen.getByText('müzik çok yüksek')).toBeTruthy());
  });
});
