import { CategoryField, Gap } from './api/models';

/** Not a fact, but asked for like one. */
export const CONDITION = 'Condition';
export const MAX_CARDS = 5;

export interface KnownFact {
  name: string;
  value: string;
  source: 'LABEL' | 'SELLER' | 'SUGGESTION' | 'WEB';
}

export interface GapCard {
  fact: string;
  kind: NonNullable<Gap['kind']>;
  /** the AI's question; empty when the page phrases it (translated) from the fact name */
  prompt: string;
  options: string[];
  /** the suggested value of a CONFIRM card */
  value?: string;
  /** where on an existing photo (1-based) the missing detail likely is: x, y, width, height as fractions */
  hint?: { photo: number; box: number[] };
}

const hintOf = (gap: Gap | undefined): GapCard['hint'] =>
  gap?.kind === 'PHOTO' && gap.photo && gap.box?.length === 4
    ? { photo: gap.photo, box: gap.box }
    : undefined;

const confirmed = (fact: KnownFact | undefined) =>
  !!fact?.value.trim() && (fact.source === 'LABEL' || fact.source === 'SELLER');

/**
 * The cards the seller still has to answer: key facts that are missing or only suggested, and the
 * condition when it is unknown. Brand and Model first, then condition, then catalog order.
 */
export function openGaps(
  fields: CategoryField[],
  facts: KnownFact[],
  condition: string,
  aiGaps: Gap[],
  skipped: ReadonlySet<string>,
  limit = MAX_CARDS,
): GapCard[] {
  const keyFacts = fields.map((f) => f.name ?? '');
  const identity: string[] = keyFacts.filter((name) => name === 'Brand' || name === 'Model');
  const rest = keyFacts.filter((name) => !identity.includes(name));
  const cards: GapCard[] = [];
  for (const name of [...identity, CONDITION, ...rest]) {
    if (skipped.has(name)) continue;
    const ai = aiGaps.find((gap) => gap.fact === name);
    if (name === CONDITION) {
      if (!condition)
        // picked from chips; the AI's photo idea for it is not needed
        cards.push({ fact: name, kind: 'ASK', prompt: '', options: [] });
      continue;
    }
    const fact = facts.find((f) => f.name === name);
    if (confirmed(fact)) continue;
    if (fact?.value.trim()) {
      cards.push({
        fact: name,
        kind: 'CONFIRM',
        prompt: '',
        options: [],
        value: fact.value,
      });
    } else {
      const kind = ai?.kind && ai.kind !== 'CONFIRM' ? ai.kind : 'ASK';
      cards.push({
        fact: name,
        kind,
        prompt: ai?.prompt ?? '',
        options: ai?.options?.length
          ? ai.options
          : (fields.find((f) => f.name === name)?.options ?? []),
        ...(kind === 'PHOTO' && hintOf(ai) ? { hint: hintOf(ai) } : {}),
      });
    }
  }
  return cards.slice(0, Math.max(0, limit));
}

/** Share of the category's key facts that come from a label or the seller. */
export function completeness(keyFacts: string[], facts: KnownFact[]): number {
  if (!keyFacts.length) return 1;
  return (
    keyFacts.filter((name) => confirmed(facts.find((f) => f.name === name))).length /
    keyFacts.length
  );
}
