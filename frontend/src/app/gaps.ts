import { Gap } from './api/models';

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
  prompt: string;
  options: string[];
  /** the suggested value of a CONFIRM card */
  value?: string;
}

const confirmed = (fact: KnownFact | undefined) =>
  !!fact?.value.trim() && (fact.source === 'LABEL' || fact.source === 'SELLER');

/**
 * The cards the seller still has to answer: key facts that are missing or only suggested, and the
 * condition when it is unknown. Brand and Model first, then condition, then catalog order.
 */
export function openGaps(
  keyFacts: string[],
  facts: KnownFact[],
  condition: string,
  aiGaps: Gap[],
  skipped: ReadonlySet<string>,
): GapCard[] {
  const identity: string[] = keyFacts.filter((name) => name === 'Brand' || name === 'Model');
  const rest = keyFacts.filter((name) => !identity.includes(name));
  const cards: GapCard[] = [];
  for (const name of [...identity, CONDITION, ...rest]) {
    if (skipped.has(name)) continue;
    const ai = aiGaps.find((gap) => gap.fact === name);
    if (name === CONDITION) {
      if (!condition)
        cards.push({
          fact: name,
          kind: 'PHOTO',
          prompt: ai?.prompt ?? 'Fotografiere den ganzen Artikel, damit man den Zustand sieht',
          options: [],
        });
      continue;
    }
    const fact = facts.find((f) => f.name === name);
    if (confirmed(fact)) continue;
    if (fact?.value.trim()) {
      cards.push({
        fact: name,
        kind: 'CONFIRM',
        prompt: `${name}: ${fact.value}?`,
        options: [],
        value: fact.value,
      });
    } else {
      const kind = ai?.kind && ai.kind !== 'CONFIRM' ? ai.kind : 'ASK';
      cards.push({
        fact: name,
        kind,
        prompt: ai?.prompt ?? `${name}?`,
        options: ai?.options ?? [],
      });
    }
  }
  return cards.slice(0, MAX_CARDS);
}

/** Share of the category's key facts that come from a label or the seller. */
export function completeness(keyFacts: string[], facts: KnownFact[]): number {
  if (!keyFacts.length) return 1;
  return (
    keyFacts.filter((name) => confirmed(facts.find((f) => f.name === name))).length /
    keyFacts.length
  );
}
