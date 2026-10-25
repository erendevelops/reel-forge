import { z } from 'zod';
import { CARD_TYPES, type CardType } from '../../plan';
import type { CardTemplate } from '../types';
import { titleCard } from './title-card';
import { numberedList } from './numbered-list';
import { logoPop } from './logo-pop';
import { rollingNumber } from './rolling-number';
import { checklist } from './checklist';
import { stamp } from './stamp';
import { barChart } from './bar-chart';
import { typedTitle } from './typed-title';
import { followOutro } from './follow-outro';

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
  'rolling-number': rollingNumber,
  checklist,
  stamp,
  'bar-chart': barChart,
  'typed-title': typedTitle,
  'follow-outro': followOutro,
};

export const cardRegistry: Record<CardType, CardTemplate> = Object.fromEntries(
  CARD_TYPES.map((t) => [t, implemented[t] ?? notImplemented(t)]),
) as Record<CardType, CardTemplate>;
