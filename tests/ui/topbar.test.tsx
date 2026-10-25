import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopBar } from '../../components/TopBar';

describe('TopBar', () => {
  it('renders brand and language switch', async () => {
    const onChange = vi.fn();
    render(<TopBar lang="tr" onLanguageChange={onChange} />);
    expect(screen.getByText('REELFORGE')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'TR' }).getAttribute('aria-current')).toBe('true');
    expect(screen.getByRole('button', { name: 'EN' }).getAttribute('aria-current')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(onChange).toHaveBeenCalledWith('en');
  });
});
