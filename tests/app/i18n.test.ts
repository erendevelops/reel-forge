import { describe, expect, it } from 'vitest';
import { tr } from '../../lib/i18n/tr';
import { en } from '../../lib/i18n/en';
import { t } from '../../lib/i18n';

function keys(o: unknown, prefix = ''): string[] {
  if (typeof o !== 'object' || o === null) return [prefix];
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

describe('i18n', () => {
  it('en has every tr key', () => {
    expect(keys(en).sort()).toEqual(keys(tr).sort());
  });

  it('t() picks the dictionary by language', () => {
    expect(t('en')).toBe(en);
    expect(t('tr')).toBe(tr);
  });
});
