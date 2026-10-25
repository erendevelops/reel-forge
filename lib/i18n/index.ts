import { tr, type Dictionary } from './tr';
import { en } from './en';

export type Language = 'tr' | 'en';

export function t(lang: Language): Dictionary {
  return lang === 'en' ? en : tr;
}

export type { Dictionary };
