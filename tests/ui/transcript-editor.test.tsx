import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TranscriptEditor } from '../../components/TranscriptEditor';
import { tr } from '../../lib/i18n/tr';

const t = {
  language: 'tr',
  words: [
    { w: 'Para', start: 0, end: 0.3 },
    { w: 'var.', start: 0.3, end: 0.6 },
    { w: 'Ben', start: 6.2, end: 6.4 },
    { w: 'fokus', start: 6.4, end: 6.8 },
  ],
};

describe('TranscriptEditor', () => {
  it('edits a word chip in place and saves the full word list', async () => {
    const onSave = vi.fn();
    render(<TranscriptEditor lang="tr" transcript={t} onSave={onSave} />);
    expect(screen.getByText('0:06')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'fokus' }));
    const input = screen.getByDisplayValue('fokus');
    await userEvent.clear(input);
    await userEvent.type(input, 'Fooocus{Enter}');
    const chip = screen.getByRole('button', { name: 'Fooocus' });
    expect(chip.className).toContain('edited');
    await userEvent.click(screen.getByRole('button', { name: tr.transcript.confirm }));
    expect(onSave).toHaveBeenCalledWith(['Para', 'var.', 'Ben', 'Fooocus']);
  });
});
