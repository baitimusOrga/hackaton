import { Gap } from './api/models';
import { CONDITION, completeness, openGaps } from './gaps';

const BIKE = ['Brand', 'Model', 'Frame size', 'Wheel size', 'Gears', 'Brakes'];
const AI: Gap[] = [
  {
    fact: 'Model',
    kind: 'PHOTO',
    prompt: 'Photograph the model lettering',
    options: [],
    photo: 1,
    box: [0.38, 0.38, 0.3, 0.16],
  },
  { fact: 'Frame size', kind: 'ASK', prompt: 'What frame size?', options: ['M', 'L'] },
];

describe('openGaps', () => {
  it('asks identity first, then condition, then the rest, up to the limit', () => {
    const cards = openGaps(
      BIKE,
      [{ name: 'Brand', value: 'Trek', source: 'LABEL' }],
      '',
      AI,
      new Set(),
    );

    expect(cards.map((c) => c.fact)).toEqual([
      'Model',
      CONDITION,
      'Frame size',
      'Wheel size',
      'Gears',
    ]);
    expect(cards[0]).toMatchObject({
      kind: 'PHOTO',
      prompt: 'Photograph the model lettering',
      hint: { photo: 1, box: [0.38, 0.38, 0.3, 0.16] },
    });
    expect(cards[1].hint).toBeUndefined();
    // the condition is picked from chips; a title without AI text is left to the page (translated)
    expect(cards[1]).toMatchObject({ kind: 'ASK', prompt: '' });
    expect(cards[2].options).toEqual(['M', 'L']);
    expect(cards[3]).toMatchObject({ kind: 'ASK', prompt: '', options: [] });
    expect(openGaps(BIKE, [], '', AI, new Set(), 2).map((c) => c.fact)).toEqual(['Brand', 'Model']);
  });

  it('turns a suggestion into a confirm card and drops confirmed and skipped facts', () => {
    const cards = openGaps(
      BIKE,
      [
        { name: 'Brand', value: 'Trek', source: 'SELLER' },
        { name: 'Model', value: 'Marlin 7', source: 'SUGGESTION' },
      ],
      'GOOD',
      AI,
      new Set(['Frame size', 'Wheel size', 'Gears']),
    );

    expect(cards).toEqual([
      {
        fact: 'Model',
        kind: 'CONFIRM',
        prompt: '',
        options: [],
        value: 'Marlin 7',
      },
      { fact: 'Brakes', kind: 'ASK', prompt: '', options: [] },
    ]);
  });
});

describe('completeness', () => {
  it('counts confirmed key facts', () => {
    expect(
      completeness(BIKE, [
        { name: 'Brand', value: 'Trek', source: 'LABEL' },
        { name: 'Model', value: 'x', source: 'SUGGESTION' },
        { name: 'Gears', value: '12', source: 'SELLER' },
      ]),
    ).toBe(2 / 6);
  });
});
