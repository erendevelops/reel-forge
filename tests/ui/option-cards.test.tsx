import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OptionCards } from '../../components/OptionCards';
import { defaultSelection } from '../../lib/app/claude/install';
import { isOn, tilesFor } from '../../lib/app/cards/catalogue';
import { tr } from '../../lib/i18n/tr';

describe('OptionCards', () => {
  const sel = defaultSelection('talking-head');
  const n = tilesFor('talking-head').filter((t) => isOn(sel, t)).length;

  it('groups tiles six per row and counts the ticked ones', () => {
    const { container } = render(<OptionCards lang="tr" preset="talking-head" selection={sel} ratios={['9:16']} references={[]} onConfirm={vi.fn()} />);
    expect(screen.getByText(tr.cards.groups.captions)).toBeTruthy();
    expect(screen.getByText(`${n} seçili`)).toBeTruthy();
    const grid = container.querySelector('.oc-grid') as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('repeat(6, 132px)');
  });

  it('tiles toggle, show the description on hover and confirm with selection, ratios and references', async () => {
    const onConfirm = vi.fn();
    render(<OptionCards lang="tr" preset="talking-head" selection={sel} ratios={['9:16']} references={[]} onConfirm={onConfirm} showRatios />);
    const stamp = screen.getByRole('button', { name: tr.cards.items.stamp.name });
    expect(stamp.getAttribute('aria-pressed')).toBe('true');
    expect(stamp.getAttribute('title')).toBe(tr.cards.items.stamp.desc);
    await userEvent.click(stamp);
    expect(stamp.getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(screen.getByRole('checkbox', { name: '4:5' }));
    await userEvent.type(screen.getByLabelText(tr.cards.references), 'https://www.instagram.com/reels/Dej4G75uvrI/');
    await userEvent.click(screen.getByRole('button', { name: tr.cards.confirm }));
    const arg = onConfirm.mock.calls[0][0];
    expect(arg.selection.cards).not.toContain('stamp');
    expect(arg.ratios).toEqual(['9:16', '4:5']);
    expect(arg.references).toEqual(['https://www.instagram.com/reels/Dej4G75uvrI/']);
  });
});
