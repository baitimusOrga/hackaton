import { Gap } from './api/models';
import { CONDITION, completeness, openGaps } from './gaps';

const BIKE = ['Brand', 'Model', 'Frame size', 'Wheel size', 'Gears', 'Brakes'];
const AI: Gap[] = [
  { fact: 'Model', kind: 'PHOTO', prompt: 'Photograph the model lettering', options: [] },
  { fact: 'Frame size', kind: 'ASK', prompt: 'What frame size?', options: ['M', 'L'] },
];

describe('openGaps', () => {
  it('asks identity first, then condition, then the rest, at most five', () => {
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
    expect(cards[0]).toMatchObject({ kind: 'PHOTO', prompt: 'Photograph the model lettering' });
    expect(cards[1].kind).toBe('PHOTO');
    expect(cards[2].options).toEqual(['M', 'L']);
    expect(cards[3]).toMatchObject({ kind: 'ASK', prompt: 'Wheel size?', options: [] });
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
        prompt: 'Model: Marlin 7?',
        options: [],
        value: 'Marlin 7',
      },
      { fact: 'Brakes', kind: 'ASK', prompt: 'Brakes?', options: [] },
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
