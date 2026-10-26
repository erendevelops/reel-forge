import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsClient } from '../../app/settings/SettingsClient';
import { PreferenceOffer } from '../../components/PreferenceOffer';
import { tr } from '../../lib/i18n/tr';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

let calls: { url: string; method: string; body: unknown }[];
beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : null });
      return new Response(JSON.stringify({ rules: [] }));
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const rules = [
  { text: 'Liste daha sağda olsun', addedAt: '', source: 'p1' },
  { text: 'Daha az kesme', addedAt: '', source: 'p2' },
];

describe('SettingsClient', () => {
  it('lists, edits and deletes learned preferences, and switches language', async () => {
    render(<SettingsClient lang="tr" rules={rules} claudeBinary="" workspace="C:/ws" />);
    expect(screen.getByDisplayValue('Liste daha sağda olsun')).toBeTruthy();
    const first = screen.getByDisplayValue('Liste daha sağda olsun');
    await userEvent.clear(first);
    await userEvent.type(first, 'Liste sağda');
    first.blur();
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ index: 0, text: 'Liste sağda' }));
    await userEvent.click(screen.getAllByRole('button', { name: tr.settings.remove })[1]);
    expect(calls.find((c) => c.method === 'DELETE')?.body).toEqual({ index: 1 });
    await userEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(calls.find((c) => c.url === '/api/settings')?.body).toEqual({ language: 'en' });
    expect(screen.getByText('C:/ws')).toBeTruthy();
  });
});

describe('PreferenceOffer', () => {
  it('saves the rule for future projects or dismisses it', async () => {
    const onDone = vi.fn();
    render(<PreferenceOffer lang="tr" text="Liste daha sağda olsun" projectId="p1" onDone={onDone} />);
    expect(screen.getByText('Liste daha sağda olsun')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: tr.settings.savePreference }));
    expect(calls[0]).toMatchObject({ url: '/api/preferences', method: 'POST', body: { text: 'Liste daha sağda olsun', source: 'p1' } });
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });
});
