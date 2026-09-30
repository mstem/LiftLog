import { describe, expect, it } from 'vitest';
import BigNumber from 'bignumber.js';
import { LocalDate, OffsetDateTime } from '@js-joda/core';
import {
  NoProgressiveOverload,
  Rest,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import {
  PotentialSet,
  RecordedSet,
  RecordedWeightedExercise,
} from '@/models/session-models';
import { Weight } from '@/models/weight';
import { adjustByRepsWeight } from '@/models/adjust-by-reps';

const today = LocalDate.of(2026, 9, 30);
const done = OffsetDateTime.parse('2026-09-01T10:00:00Z');

/** One session of a lift: sets as [kg, reps], reps undefined = not done */
function session(
  date: string,
  target: number,
  sets: [number, number | undefined][],
) {
  const blueprint = new WeightedExerciseBlueprint(
    'Leg Press',
    sets.length,
    target,
    new NoProgressiveOverload(),
    Rest.medium,
    false,
    '',
    '',
  );
  return {
    date: LocalDate.parse(date),
    exercise: new RecordedWeightedExercise(
      blueprint,
      sets.map(
        ([kg, reps]) =>
          new PotentialSet(
            reps === undefined ? undefined : new RecordedSet(reps, done),
            new Weight(kg, 'kilograms'),
          ),
      ),
      undefined,
    ),
  };
}

function next(...history: ReturnType<typeof session>[]) {
  return adjustByRepsWeight({
    history,
    today,
    increment: new BigNumber(2.5),
  })?.value.toNumber();
}

describe('adjustByRepsWeight', () => {
  it('keeps the weight exactly when on target, with no rounding', () => {
    expect(
      next(
        session('2026-09-27', 12, [
          [59, 12],
          [59, 12],
          [59, 12],
        ]),
        session('2026-09-09', 12, [
          [59, 11],
          [59, 12],
          [59, 12],
        ]),
      ),
    ).toBe(59);
  });

  it('lets one short session be outweighed by the trend', () => {
    // Leg Press: 100 x 7 on a rushed day, fine the time before: average -0.8
    expect(
      next(
        session('2026-09-27', 10, [[100, 7]]),
        session('2026-09-09', 10, [
          [100, 10],
          [100, 12],
          [100, 12],
        ]),
      ),
    ).toBe(100);
  });

  it('takes 5% off when the lift keeps missing by 2+ reps', () => {
    expect(
      next(
        session('2026-09-14', 15, [[50, 11]]),
        session('2026-09-03', 15, [[50, 13]]),
      ),
    ).toBe(47.5);
  });

  it('takes 2% off for a whole-rep miss, when it survives rounding', () => {
    expect(next(session('2026-09-20', 10, [[200, 9]]))).toBe(195);
  });

  it('leaves a light lift alone when rounding cancels the cut', () => {
    // Lying Leg Curls: -2% of 50 is 49, back to 50
    expect(next(session('2026-09-27', 12, [[50, 11]]))).toBe(50);
  });

  it('adds weight by how far the target was beaten', () => {
    // Hack Squat 12, 12, 10 against 8: average +3.3 -> +1.5%
    expect(
      next(
        session('2026-09-09', 8, [
          [60, 12],
          [60, 12],
          [60, 10],
        ]),
      ),
    ).toBe(62.5);
  });

  it('adds one increment when a 2+ rep beat rounds to nothing', () => {
    // +1% of 100 is 101, which would round back to 100
    expect(
      next(
        session('2026-09-20', 10, [
          [100, 12],
          [100, 12],
        ]),
      ),
    ).toBe(102.5);
  });

  it('keeps a 1 rep beat that rounds to nothing where it is', () => {
    expect(next(session('2026-09-20', 10, [[100, 11]]))).toBe(100);
  });

  it('caps at the table ends', () => {
    expect(next(session('2026-09-20', 5, [[100, 15]]))).toBe(102.5);
    expect(next(session('2026-09-20', 15, [[100, 5]]))).toBe(95);
  });

  it('ignores sets that were not done', () => {
    expect(
      next(
        session('2026-09-27', 12, [
          [59, 12],
          [59, undefined],
          [59, undefined],
        ]),
      ),
    ).toBe(59);
  });

  it('only counts sets at the current weight', () => {
    // A heavier July miss says nothing about 59 kg
    expect(
      next(
        session('2026-09-27', 12, [
          [59, 12],
          [59, 12],
        ]),
        session('2026-09-20', 12, [
          [64, 8],
          [64, 8],
        ]),
      ),
    ).toBe(59);
  });

  it('uses the last three counted sessions only', () => {
    expect(
      next(
        session('2026-09-27', 10, [[100, 10]]),
        session('2026-09-20', 10, [[100, 10]]),
        session('2026-09-13', 10, [[100, 10]]),
        session('2026-09-06', 10, [[100, 3]]),
      ),
    ).toBe(100);
  });

  it('ignores sessions older than 8 weeks', () => {
    expect(
      next(
        session('2026-09-27', 10, [[100, 10]]),
        session('2026-07-01', 10, [[100, 3]]),
      ),
    ).toBe(100);
  });

  it('judges each session against its own target', () => {
    expect(
      next(
        session('2026-09-27', 8, [[100, 8]]),
        session('2026-09-20', 12, [[100, 12]]),
      ),
    ).toBe(100);
  });

  it('changes nothing with no counted sets, or at 0 kg', () => {
    expect(next()).toBeUndefined();
    expect(next(session('2026-06-01', 10, [[100, 3]]))).toBeUndefined();
    expect(next(session('2026-09-27', 3, [[0, 7]]))).toBeUndefined();
  });
});
