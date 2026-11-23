import type { Sort } from './catalogParams';
import type { ProductType } from './types';

export const TYPE_LABELS: Record<ProductType, string> = {
  game: 'Games',
  dlc: 'DLC',
  gift_card: 'eGift Cards',
  subscription: 'Subscriptions',
  software: 'Software',
};

export const SORT_LABELS: Record<Sort, string> = {
  relevance: 'Best match',
  popular: 'Most popular',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  newest: 'Newest',
};
