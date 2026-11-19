import BigNumber from 'bignumber.js';
import { LocalDate, OffsetDateTime } from '@js-joda/core';
import { RecordedWeightedExercise } from '@/models/session-models';
import { Weight } from '@/models/weight';
import { NextDayAnswer } from '@/models/injury/injury';

export interface InjuryHistoryEntry {
  sessionId: string;
  date: LocalDate;
  exercise: RecordedWeightedExercise;
}

export function sessionPassed(
  e: InjuryHistoryEntry,
  painLimit: number,
  answers: Record<string, NextDayAnswer>,
): boolean {
  return (
    e.exercise.stoppedForPainAt(painLimit) === undefined &&
    answers[e.sessionId] !== 'worse'
  );
}

function heaviest(e: InjuryHistoryEntry, unit: Weight['unit']): Weight {
  const done = e.exercise.potentialSets.filter((x) => x.set);
  const sets = done.length ? done : e.exercise.potentialSets.slice(0, 1);
  return Weight.max(...sets.map((x) => x.weight.convertTo(unit)));
}

function allTickedFrom(e: InjuryHistoryEntry, from: OffsetDateTime): boolean {
  return e.exercise.potentialSets.every(
    (x) => !x.set || !x.set.completionDateTime.isBefore(from),
  );
}

interface InjuryWeightArgs {
  /** recordings of this lift, any order; filtered to on/after onset inside */
  history: InjuryHistoryEntry[];
  onsetDate: LocalDate;
  /** weight the normal rules would give */
  carried: Weight;
  increment: BigNumber;
  painLimit: number;
  firstCut: number;
  nextDayAnswers: Record<string, NextDayAnswer>;
  /**
   * When given, a recording counts only if every ticked set was completed at
   * or after this moment (see injuryEraStart). A workout that was already
   * under way when the mode was turned on is left out, so the next one still
   * gets the first cut.
   */
  trackedFrom?: OffsetDateTime;
}

function injuryEra(args: InjuryWeightArgs): InjuryHistoryEntry[] {
  return args.history
    .filter((x) => !x.date.isBefore(args.onsetDate))
    .filter((x) => x.exercise.potentialSets.some((set) => set.set))
    .filter((x) => !args.trackedFrom || allTickedFrom(x, args.trackedFrom))
    .sort((a, b) => a.date.compareTo(b.date));
}

export function injuryWeight(args: InjuryWeightArgs): Weight {
  const { increment, painLimit, nextDayAnswers } = args;
  const era = injuryEra(args);
  const last = era[era.length - 1];
  if (!last) {
    const cut = args.carried.value.multipliedBy(args.firstCut);
    const rounded = increment.isZero()
      ? cut
      : cut
          .dividedBy(increment)
          .integerValue(BigNumber.ROUND_FLOOR)
          .multipliedBy(increment);
    return args.carried.with({ value: rounded });
  }
  const base = heaviest(last, args.carried.unit);
  if (!sessionPassed(last, painLimit, nextDayAnswers)) {
    const lower = base.value.minus(increment);
    return base.with({ value: BigNumber.max(lower, 0) });
  }
  // A lift done with no added weight (dips, push-ups) is never loaded up
  // automatically while injured; adding weight is the user's call.
  if (base.value.isZero()) {
    return base;
  }
  const prev = era[era.length - 2];
  if (
    prev &&
    sessionPassed(prev, painLimit, nextDayAnswers) &&
    heaviest(prev, args.carried.unit).equals(base)
  ) {
    return base.plus(increment);
  }
  return base;
}

/**
 * Weights for each set of a Rehab block lift. They start from the sets of the
 * last workout where the lift was ticked, each moved by the step the load
 * rule gives, so a lighter first set stays lighter. The next-day answer is
 * left out: it rates the whole workout, and rehab lifts are the ones meant to
 * keep going on a bad day. A pain stop in the lift itself still drops a step.
 */
export function rehabWeights(
  args: InjuryWeightArgs & { sets: number },
): Weight[] {
  const ruleArgs = { ...args, nextDayAnswers: {} };
  const step = injuryWeight(ruleArgs);
  const era = injuryEra(ruleArgs);
  const last = era[era.length - 1];
  const lastSets = last?.exercise.potentialSets ?? [];
  if (!last || !lastSets.length) {
    return Array.from({ length: args.sets }, () => step);
  }
  const unit = args.carried.unit;
  const delta = step.value.minus(heaviest(last, unit).value);
  return Array.from({ length: args.sets }, (_, i) => {
    const w = (lastSets[i] ?? lastSets[lastSets.length - 1]!).weight.convertTo(
      unit,
    );
    return w.with({ value: BigNumber.max(w.value.plus(delta), 0) });
  });
}
