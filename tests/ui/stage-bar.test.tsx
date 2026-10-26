import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StageBar } from '../../components/StageBar';
import { postJob } from '../../components/post-job';
import { tr } from '../../lib/i18n/tr';

describe('StageBar', () => {
  it('marks the current step and ticks the earlier ones', () => {
    render(<StageBar lang="tr" stage="music" />);
    const current = screen.getByText(tr.stages.transcript).closest('li')!;
    expect(current.getAttribute('aria-current')).toBe('step');
    expect(screen.getByText(tr.stages.footage).closest('li')!.textContent).toContain('✓');
    expect(screen.getByText(tr.stages.review).closest('li')!.getAttribute('aria-current')).toBeNull();
  });

  it('lights Render while a final render runs', () => {
    render(<StageBar lang="en" stage="storyboard" rendering />);
    expect(screen.getByText('Render').closest('li')!.getAttribute('aria-current')).toBe('step');
  });
});

describe('postJob', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('turns a 409 into the busy message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'a job is already running for p' }), { status: 409 })));
    expect(await postJob('/api/x', {}, 'tr')).toEqual({ error: tr.common.busy });
  });
  it('returns the job id on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ jobId: 'job-1' }), { status: 201 })));
    expect(await postJob('/api/x', {}, 'tr')).toEqual({ jobId: 'job-1' });
  });
});
