import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { StoryboardClient } from '../../app/projects/[id]/StoryboardClient';
import { tr } from '../../lib/i18n/tr';
import type { Plan } from '../../lib/plan';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const v5 = (): Plan => JSON.parse(readFileSync('skills/video-core/examples/plan-faceless-v5.json', 'utf8'));
const project = { id: 'p1', mode: 'reel' as const, preset: 'faceless' as const, ratios: ['9:16' as const] };
const versions = [{ n: 1, by: 'claude' as const, parent: null, request: 'first cut', diff: null, createdAt: '' }];

let calls: { url: string; body: unknown }[];
let approveStatus = 201;
beforeEach(() => {
  calls = [];
  approveStatus = 201;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url, body });
      if (url.endsWith('/preview')) return new Response(JSON.stringify({ url: '/p/index.html?k=1', key: '1' }));
      if (url.endsWith('/versions')) return new Response(JSON.stringify({ n: 2, parent: 1, branched: false }), { status: 201 });
      if (url.endsWith('/jobs')) return new Response(JSON.stringify(approveStatus === 409 ? { error: 'busy' } : { jobId: 'job-1' }), { status: approveStatus });
      if (url.endsWith('/claude')) return new Response(JSON.stringify({ jobId: 'job-2' }), { status: 201 });
      return new Response('{}');
    }),
  );
  vi.stubGlobal('EventSource', class { onmessage = null; onerror = null; close() {} });
});
afterEach(() => vi.unstubAllGlobals());

const mount = (over: Partial<typeof project> & { plan?: Plan } = {}) =>
  render(<StoryboardClient lang="tr" project={{ ...project, ...over }} versions={versions} initial={{ n: 1, plan: over.plan ?? v5() }} lastJobId={null} />);

describe('StoryboardClient', () => {
  it('lists one line per scene and shows the selected scene\'s why', async () => {
    mount();
    expect(screen.getAllByRole('listitem').length).toBe(v5().scenes.length);
    expect(screen.getByText('01 · 0:00')).toBeTruthy();
    await userEvent.click(screen.getByText('02 · 0:06'));
    expect(screen.getByText(v5().scenes[1].why)).toBeTruthy();
  });

  it('a direct edit enables save with its count, posts the edits, and undo takes it back', async () => {
    mount();
    await userEvent.click(screen.getByText('02 · 0:06'));
    const name = screen.getByLabelText('name');
    fireEvent.change(name, { target: { value: 'Fooocus AI' } });
    const save = screen.getByRole('button', { name: `${tr.storyboard.save} (1)` });
    await userEvent.click(screen.getByRole('button', { name: tr.storyboard.undo }));
    expect(screen.queryByRole('button', { name: `${tr.storyboard.save} (1)` })).toBeNull();
    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'Fooocus AI' } });
    await userEvent.click(screen.getByRole('button', { name: `${tr.storyboard.save} (1)` }));
    expect(save).toBeTruthy();
    const sent = calls.find((c) => c.url.endsWith('/versions'))!;
    expect(sent.body).toEqual({ parent: 1, edits: [{ op: 'card-param', scene: 'fooocus', card: 0, key: 'name', value: 'Fooocus AI' }] });
  });

  it('asks Claude about the selected scene', async () => {
    mount();
    await userEvent.click(screen.getByText('02 · 0:06'));
    await userEvent.type(screen.getByRole('textbox', { name: tr.storyboard.ask }), 'biraz daha uzun{Enter}');
    const sent = calls.find((c) => c.url.endsWith('/claude'))!;
    expect(sent.body).toEqual({ stage: 'revise', request: '[scene fooocus] biraz daha uzun' });
  });

  it('shows the busy message when a job already runs', async () => {
    approveStatus = 409;
    mount();
    await userEvent.click(screen.getByRole('button', { name: tr.storyboard.approve }));
    await waitFor(() => expect(screen.getByText(tr.common.busy)).toBeTruthy());
    expect(calls.find((c) => c.url.endsWith('/jobs'))!.body).toEqual({ kind: 'render', version: 1, profile: 'final' });
  });

  it('app videos offer the kit colours and say animations change through Claude', async () => {
    const plan = { ...v5(), mode: 'app' as const, look: { background: '#0B0B0C', accent: '#F87171' } };
    mount({ mode: 'app', preset: 'app-video', plan } as never);
    const accent = screen.getByLabelText('accent') as HTMLInputElement;
    expect(accent.value.toLowerCase()).toBe('#f87171');
    expect(screen.getByText(tr.storyboard.animNote)).toBeTruthy();
    await act(async () => {});
  });
});

describe('StoryboardClient review fixes', () => {
  it('a version Claude saves while edits are pending does not wipe them; it is offered instead', async () => {
    const { rerender } = mount();
    await userEvent.click(screen.getByText('02 · 0:06'));
    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'Fooocus AI' } });
    const v2 = [...versions, { n: 2, by: 'claude' as const, parent: 1, request: 'shorter', diff: null, createdAt: '' }];
    rerender(<StoryboardClient lang="tr" project={project} versions={v2} initial={{ n: 1, plan: v5() }} lastJobId={null} />);
    expect(screen.getByRole('button', { name: `${tr.storyboard.save} (1)` })).toBeTruthy();
    expect(screen.getByText(new RegExp(`v2 ${tr.storyboard.ready}`))).toBeTruthy();
    expect(calls.some((c) => c.url.endsWith('/versions/2'))).toBe(false);
  });

  it('a typed number commits on blur, so intermediate keystrokes are never refused', async () => {
    mount();
    await userEvent.click(screen.getByText('02 · 0:06'));
    const end = screen.getAllByLabelText(tr.storyboard.end)[0] as HTMLInputElement;
    await userEvent.clear(end);
    await userEvent.type(end, '10.5');
    expect(end.value).toBe('10.5');
    fireEvent.blur(end);
    await userEvent.click(screen.getByRole('button', { name: `${tr.storyboard.save} (1)` }));
    const sent = calls.find((c) => c.url.endsWith('/versions'))!;
    expect((sent.body as { edits: { op: string; end: number }[] }).edits[0]).toMatchObject({ op: 'card-time', end: 10.5 });
  });

  it('only the newest preview build is shown, even if an older one answers last', async () => {
    let n = 0;
    const slow: ((r: Response) => void)[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (!url.endsWith('/preview')) return new Response('{}');
      n += 1;
      const me = n;
      if (me === 1) return new Promise<Response>((res) => slow.push(res));
      return new Response(JSON.stringify({ url: `/p/${me}/index.html`, key: String(me) }));
    }));
    const { container } = mount();
    await new Promise((r) => setTimeout(r, 450));
    await userEvent.click(screen.getByText('02 · 0:06'));
    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'X' } });
    await waitFor(() => expect(container.querySelector('iframe')?.getAttribute('src')).toBe('/p/2/index.html'), { timeout: 2000 });
    slow[0](new Response(JSON.stringify({ url: '/p/1/index.html', key: '1' })));
    await new Promise((r) => setTimeout(r, 50));
    expect(container.querySelector('iframe')?.getAttribute('src')).toBe('/p/2/index.html');
  });
});
