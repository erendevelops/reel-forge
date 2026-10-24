import { z } from 'zod';
import { CARD_TYPES, type CardType } from '../../plan';
import type { CardTemplate } from '../types';
import { titleCard } from './title-card';
import { numberedList } from './numbered-list';
import { logoPop } from './logo-pop';

function notImplemented(type: CardType): CardTemplate {
  return {
    type,
    params: z.record(z.string(), z.unknown()),
    render() {
      throw new Error(`not implemented: ${type}`);
    },
  };
}

const implemented: Partial<Record<CardType, CardTemplate>> = {
  'title-card': titleCard,
  'numbered-list': numberedList,
  'logo-pop': logoPop,
};

export const cardRegistry: Record<CardType, CardTemplate> = Object.fromEntries(
  CARD_TYPES.map((t) => [t, implemented[t] ?? notImplemented(t)]),
) as Record<CardType, CardTemplate>;
