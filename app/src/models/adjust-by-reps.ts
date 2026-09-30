import BigNumber from 'bignumber.js';
import { LocalDate } from '@js-joda/core';
import { RecordedWeightedExercise } from '@/models/session-models';
import { Weight } from '@/models/weight';

/**
 * Weight change by how far a lift's reps were from its target, from the SBS
 * Hypertrophy template: 2+ short, 1 short, on target, then beat by 1 to 5+.
 */
const changeByRepsFromTarget: Record<number, number> = {
  [-2]: -0.05,
  [-1]: -0.02,
  0: 0,
  1: 0.005,
  2: 0.01,
  3: 0.015,
  4: 0.02,
  5: 0.03,
};

const sessionsToCount = 3;
const windowWeeks = 8;

/**
 * Next weight for a lift set to adjust by reps, from its recent history
 * (newest first), or undefined to leave it alone.
 *
 * Only ticked sets at the current weight count - a set not done is not a miss,
 * and a set at another weight says nothing about this one. The last three such
 * sessions within eight weeks each score their average reps over target; the
 * mean of those, in whole reps, picks the change.
 */
export function adjustByRepsWeight({
  history,
  today,
  increment,
}: {
  history: readonly { date: LocalDate; exercise: RecordedWeightedExercise }[];
  today: LocalDate;
  increment: BigNumber;
}): Weight | undefined {
  const recent = history.filter(
    (x) => !x.date.isBefore(today.minusWeeks(windowWeeks)),
  );
  const current = recent
    .map((x) => x.exercise.potentialSets.filter((s) => s.set).at(-1)?.weight)
    .find((x) => x !== undefined);
  if (!current || current.value.isZero()) {
    return undefined;
  }

  const scores = recent
    .map(({ exercise }) => {
      const counted = exercise.potentialSets.filter(
        (s) => s.set && s.weight.equals(current, true),
      );
      if (!counted.length) {
        return undefined;
      }
      const target = exercise.blueprint.repsPerSet;
      return (
        counted.reduce((sum, s) => sum + s.set!.repsCompleted - target, 0) /
        counted.length
      );
    })
    .filter((x) => x !== undefined)
    .slice(0, sessionsToCount);
  if (!scores.length) {
    return undefined;
  }

  const average = scores.reduce((a, b) => a + b, 0) / scores.length;
  const repsFromTarget = Math.max(-2, Math.min(5, Math.trunc(average)));
  const change = changeByRepsFromTarget[repsFromTarget]!;
  if (change === 0) {
    return current;
  }

  const rounded = new Weight(
    current.value
      .multipliedBy(1 + change)
      .dividedBy(increment)
      .integerValue(BigNumber.ROUND_HALF_UP)
      .multipliedBy(increment),
    current.unit,
  );
  // Small gains vanish in the rounding on light lifts, so a clear beat still
  // moves them. Small cuts are left to vanish.
  if (rounded.equals(current) && repsFromTarget >= 2) {
    return current.plus(increment);
  }
  return rounded;
}
