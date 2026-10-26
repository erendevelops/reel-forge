import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MusicPick } from '../../components/MusicPick';
import { tr } from '../../lib/i18n/tr';

const candidates = [
  { title: 'Ambient Minimal', url: 'https://pixabay.com/music/a', license: 'Pixabay Content License', why: 'calm build', contentId: true },
  { title: 'Soft Tech', url: 'https://pixabay.com/music/b', license: 'Pixabay Content License', why: 'light' },
];

describe('MusicPick', () => {
  it('shows each candidate with its reason, licence, Content ID badge and a safe external link', () => {
    render(<MusicPick lang="tr" candidates={candidates} picked={null} onPick={vi.fn()} onUpload={vi.fn()} onMore={vi.fn()} />);
    expect(screen.getByText('calm build')).toBeTruthy();
    expect(screen.getAllByText('Content ID')).toHaveLength(1);
    const link = screen.getAllByRole('link')[0];
    expect(link.getAttribute('href')).toBe('https://pixabay.com/music/a');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noreferrer');
  });

  it('picking shows the drop zone; "suggest others" and upload call back', async () => {
    const onPick = vi.fn();
    const onUpload = vi.fn();
    const onMore = vi.fn();
    const { rerender } = render(<MusicPick lang="tr" candidates={candidates} picked={null} onPick={onPick} onUpload={onUpload} onMore={onMore} />);
    await userEvent.click(screen.getAllByRole('button', { name: tr.music.pick })[1]);
    expect(onPick).toHaveBeenCalledWith(1);
    await userEvent.click(screen.getByRole('button', { name: tr.music.more }));
    expect(onMore).toHaveBeenCalled();
    rerender(<MusicPick lang="tr" candidates={candidates} picked={{ title: 'Soft Tech', url: 'https://pixabay.com/music/b', license: 'x', file: null }} onPick={onPick} onUpload={onUpload} onMore={onMore} />);
    expect(screen.getByText(tr.music.drop)).toBeTruthy();
    const file = new File(['x'], 'soft.mp3', { type: 'audio/mpeg' });
    await userEvent.upload(screen.getByLabelText(tr.music.drop), file);
    expect(onUpload).toHaveBeenCalledWith(file);
  });
});
