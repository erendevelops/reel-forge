import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JobLog } from '../../components/JobLog';
import type { JobEvent } from '../../lib/app/jobs/jobs';

const t = '2026-10-25T12:00:00.000Z';

describe('JobLog', () => {
  it('job log shows paused-limit with reset time and resume button', async () => {
    const onResume = vi.fn();
    const events: JobEvent[] = [
      { t, type: 'state', state: 'running' },
      { t, type: 'claude', event: { kind: 'tool', name: 'Bash', summary: 'Bash: ffprobe -v error inputs/clip.mov' } },
      { t, type: 'claude', event: { kind: 'error', code: 'limit', message: 'limit', resetsAt: '2pm (Europe/Istanbul)' } },
      { t, type: 'state', state: 'paused-limit', detail: '2pm (Europe/Istanbul)' },
    ];
    render(<JobLog lang="en" events={events} onResume={onResume} />);
    expect(screen.getByText('Bash: ffprobe -v error inputs/clip.mov')).toBeTruthy();
    expect(screen.getByText(/Claude usage limit reached/)).toBeTruthy();
    expect(screen.getByText(/2pm \(Europe\/Istanbul\)/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(onResume).toHaveBeenCalled();
  });

  it('shows per-ratio render progress', () => {
    const events: JobEvent[] = [
      { t, type: 'state', state: 'running' },
      { t, type: 'progress', step: '9:16 render' },
      { t, type: 'progress', step: '4:5 render' },
      { t, type: 'progress', step: '9:16 done' },
    ];
    render(<JobLog lang="en" events={events} onResume={() => {}} />);
    expect(screen.getByText('9:16').closest('[data-ratio]')?.getAttribute('data-stage')).toBe('done');
    expect(screen.getByText('4:5').closest('[data-ratio]')?.getAttribute('data-stage')).toBe('render');
    expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
  });
});
