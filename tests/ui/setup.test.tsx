import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SetupList } from '../../components/SetupList';

const rows = (faceOk: boolean) => [
  { id: 'node' as const, ok: true, detail: 'v22.0.0', fix: null },
  { id: 'ffmpeg' as const, ok: false, detail: 'not found', fix: 'winget install Gyan.FFmpeg' },
  { id: 'face-model' as const, ok: faceOk, detail: faceOk ? '229 KB' : 'missing', fix: faceOk ? null : 'download' },
];

describe('SetupList', () => {
  it('setup page lists checks with ok/fix states and a download button only when face-model fails', async () => {
    const onDownload = vi.fn();
    const { rerender } = render(<SetupList lang="en" checks={rows(false)} onDownloadFaceModel={onDownload} onRecheck={() => {}} />);
    expect(screen.getByText('Node.js 20+')).toBeTruthy();
    expect(screen.getByText('winget install Gyan.FFmpeg')).toBeTruthy();
    expect(screen.getAllByLabelText('ok')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: /Download face model/ }));
    expect(onDownload).toHaveBeenCalled();
    rerender(<SetupList lang="en" checks={rows(true)} onDownloadFaceModel={onDownload} onRecheck={() => {}} />);
    expect(screen.queryByRole('button', { name: /Download face model/ })).toBeNull();
  });
});
