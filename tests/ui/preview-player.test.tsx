import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreviewPlayer } from '../../components/PreviewPlayer';
import { tr } from '../../lib/i18n/tr';

describe('PreviewPlayer', () => {
  it('posts seek when the scrubber moves and toggles play/pause', async () => {
    const onPlaying = vi.fn();
    const { container } = render(<PreviewPlayer lang="tr" src="/p/index.html?k=1" ratio="9:16" duration={10} time={0} playing={false} onPlaying={onPlaying} onTime={vi.fn()} />);
    const frame = container.querySelector('iframe')!;
    const post = vi.spyOn(frame.contentWindow!, 'postMessage');
    fireEvent.change(screen.getByRole('slider'), { target: { value: '4.5' } });
    expect(post).toHaveBeenCalledWith({ rf: 'seek', t: 4.5 }, '*');
    await userEvent.click(screen.getByRole('button', { name: tr.preview.play }));
    expect(onPlaying).toHaveBeenCalledWith(true);
    expect(post).toHaveBeenCalledWith({ rf: 'play' }, '*');
  });
});
