import { describe, expect, it } from 'vitest';
import { LocalDate, OffsetDateTime } from '@js-joda/core';
import {
  CardioExerciseBlueprint,
  NoProgressiveOverload,
  Rest,
  SessionBlueprint,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import {
  PotentialSet,
  RecordedCardioExercise,
  RecordedSet,
  RecordedWeightedExercise,
  Session,
} from '@/models/session-models';
import { Weight } from '@/models/weight';
import { makeCardioSetBlueprint } from '@/models/session-models/__test__/helpers';
import {
  muscleGapLevel,
  muscleGaps,
  wellTrainedSets,
} from '@/models/muscle-gaps';

const today = LocalDate.of(2026, 9, 30);
const done = OffsetDateTime.parse('2026-09-20T10:00:00Z');

const library = [
  { name: 'Barbell Squat', muscles: ['quadriceps', 'glutes'] },
  { name: 'Crunches', muscles: ['abdominals'] },
  { name: 'Lat Pulldown', muscles: ['lats', 'middle back'] },
];

function lift(name: string, sets: (number | undefined)[], group?: string) {
  const bp = new WeightedExerciseBlueprint(
    name,
    sets.length,
    10,
    new NoProgressiveOverload(),
    Rest.medium,
    false,
    '',
    '',
    group,
  );
  return new RecordedWeightedExercise(
    bp,
    sets.map(
      (kg) =>
        new PotentialSet(
          kg === undefined ? undefined : new RecordedSet(10, done),
          new Weight(kg ?? 20, 'kilograms'),
        ),
    ),
    undefined,
  );
}

function session(date: string, exercises: Session['recordedExercises']) {
  return new Session(
    `s-${date}`,
    new SessionBlueprint(
      'Test',
      exercises.map((x) => x.blueprint),
      '',
    ),
    exercises,
    LocalDate.parse(date),
    undefined,
    undefined,
  );
}

const gaps = (...sessions: Session[]) =>
  muscleGaps({ sessions, library, today });

describe('muscleGaps', () => {
  it('counts ticked sets for each region the exercise works', () => {
    const result = gaps(
      session('2026-09-20', [lift('Barbell Squat', [60, 60, undefined])]),
    );

    expect(result.quadriceps).toBe(2);
    expect(result.gluteal).toBe(2);
    expect(result.chest).toBe(0);
  });

  it('matches library names regardless of case and spacing', () => {
    expect(
      gaps(session('2026-09-20', [lift(' barbell squat', [60])])).quadriceps,
    ).toBe(1);
  });

  it('counts bodyweight and Mobility sets as half a set', () => {
    const result = gaps(
      session('2026-09-20', [
        lift('Barbell Squat', [0, 0]),
        lift('Crunches', [5], 'Mobility'),
      ]),
    );

    expect(result.quadriceps).toBe(1);
    expect(result.abs).toBe(0.5);
  });

  it('counts completed timed sets as bodyweight work', () => {
    const plank = new CardioExerciseBlueprint(
      'Plank',
      [makeCardioSetBlueprint(), makeCardioSetBlueprint()],
      '',
      '',
    );
    const recorded = new RecordedCardioExercise(
      plank,
      RecordedCardioExercise.empty(plank).sets.map((s, i) =>
        i === 0 ? s.with({ completionDateTime: done }) : s,
      ),
      undefined,
    );

    const result = gaps(session('2026-09-20', [recorded]));

    expect(result.abs).toBe(0.5);
    expect(result.obliques).toBe(0.5);
  });

  it('spreads library abdominals over abs and obliques', () => {
    const result = gaps(session('2026-09-20', [lift('Crunches', [10])]));

    expect(result.abs).toBe(1);
    expect(result.obliques).toBe(1);
  });

  it('counts an exercise once for a region two of its muscles share', () => {
    // Lats and middle back are both the upper back on the diagram
    expect(
      gaps(session('2026-09-20', [lift('Lat Pulldown', [50, 50])]))[
        'upper-back'
      ],
    ).toBe(2);
  });

  it('uses the built-in map for names the library lacks', () => {
    const result = gaps(
      session('2026-09-20', [
        lift('Side Plank', [0], 'Mobility'),
        lift('Lizard Elbow Extensions', [0], 'Mobility'),
      ]),
    );

    expect(result.obliques).toBe(0.5);
    expect(result.abs).toBe(0);
    // Hip flexors have no region of their own and show on the quadriceps
    expect(result.quadriceps).toBe(0.5);
    expect(result.adductors).toBe(0.5);
  });

  it('only looks at the last 30 days', () => {
    const result = gaps(
      session('2026-09-01', [lift('Barbell Squat', [60])]),
      session('2026-08-31', [lift('Barbell Squat', [60])]),
    );

    expect(result.quadriceps).toBe(1);
  });

  it('ignores exercises with no known muscles', () => {
    const result = gaps(session('2026-09-20', [lift('Mystery Move', [60])]));

    expect(Object.values(result).every((x) => x === 0)).toBe(true);
  });

  it('includes every region, neck too', () => {
    expect(Object.keys(gaps()).sort()).toEqual(
      [
        'abs',
        'adductors',
        'biceps',
        'calves',
        'chest',
        'deltoids',
        'forearm',
        'gluteal',
        'hamstring',
        'lower-back',
        'neck',
        'obliques',
        'quadriceps',
        'trapezius',
        'triceps',
        'upper-back',
      ].sort(),
    );
  });
});

describe('muscleGapLevel', () => {
  it('runs from 1 (untrained, red) to 5 (well trained, green)', () => {
    expect(wellTrainedSets).toBe(20);
    expect(muscleGapLevel(0)).toBe(1);
    expect(muscleGapLevel(4)).toBe(1);
    expect(muscleGapLevel(5)).toBe(2);
    expect(muscleGapLevel(10)).toBe(3);
    expect(muscleGapLevel(15)).toBe(4);
    expect(muscleGapLevel(19.5)).toBe(4);
    expect(muscleGapLevel(20)).toBe(5);
    expect(muscleGapLevel(50)).toBe(5);
  });
});
