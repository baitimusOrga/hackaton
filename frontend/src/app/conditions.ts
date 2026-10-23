import { ListingSummary } from './api/models';

export type Condition = NonNullable<ListingSummary['condition']>;

/** German labels for the backend's listing conditions. */
export const CONDITION_LABELS: Record<Condition, string> = {
  NEW: 'Neu',
  LIKE_NEW: 'Wie neu',
  GOOD: 'Gut',
  USED: 'Gebraucht',
  DEFECTIVE: 'Defekt',
};

export const conditionLabel = (condition?: string | null): string =>
  CONDITION_LABELS[condition as Condition] ?? '';

/** A card's grey meta line: the non-empty parts joined with " · ". */
export const metaLine = (...parts: (string | null | undefined)[]): string =>
  parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' · ');
