import { describe, it, expect } from 'vitest';
import { NormalizedName } from '@/models/blueprint-models';
import { isShoulderLoaded } from '@/models/injury/flags';

describe('isShoulderLoaded', () => {
  it.each([
    'Standing Military Press',
    'Barbell Bench Press - Medium Grip',
    'Dumbbell Bench Press',
    'Dips - Triceps Version',
    'Upright Barbell Row',
    'Seated Barbell Military Press',
    'Floor Press',
    'Side Lateral Raise',
  ])('flags %s', (name) => {
    expect(isShoulderLoaded(name, {})).toBe(true);
  });

  it.each(['Barbell Squat', 'Barbell Curl', 'Pullups', 'Leg Press'])(
    'does not flag %s',
    (name) => {
      expect(isShoulderLoaded(name, {})).toBe(false);
    },
  );

  it('honours an override either way', () => {
    expect(
      isShoulderLoaded('Barbell Squat', {
        [new NormalizedName('Barbell Squat').toString()]: true,
      }),
    ).toBe(true);
    expect(
      isShoulderLoaded('Standing Military Press', {
        [new NormalizedName('Standing Military Press').toString()]: false,
      }),
    ).toBe(false);
  });
});
