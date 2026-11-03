import {
  DayOfWeek,
  Duration,
  LocalDate,
  TemporalAdjusters,
  YearMonth,
} from '@js-joda/core';
import BigNumber from 'bignumber.js';
import { NormalizedName } from '@/models/blueprint-models';
import {
  MuscleGapRegion,
  muscleGapRegions,
  muscleGaps,
  wellTrainedSets,
} from '@/models/muscle-gaps';
import {
  RecordedCardioExercise,
  RecordedWeightedExercise,
  Session,
} from '@/models/session-models';
import { Weight, WeightUnit } from '@/models/weight';

export interface MonthlyBest {
  name: string;
  weight: Weight;
  previous: Weight;
}

export interface MonthlyReport {
  month: YearMonth;
  workouts: number;
  /** Weeks, starting on the user's first day, with 3 or more workouts */
  weeksWithThreeOrMore: number;
  sets: number;
  volume: Weight;
  timeTrained: Duration;
  /** Heaviest weight beaten this month, biggest gain first, at most 5 */
  bests: MonthlyBest[];
  mostWorked: MuscleGapRegion[];
  barelyReached: MuscleGapRegion[];
  bodyweightStart: Weight | undefined;
  bodyweightEnd: Weight | undefined;
  byName: { name: string; count: number }[];
}

const listedBests = 5;
const listedMuscles = 3;

const isDone = (session: Session) =>
  session.recordedExercises.some((x) => x.isStarted);

/**
 * The month's training, from finished workouts dated in it. Bests compare with
 * every workout before the month; a lift done for the first time is not a best.
 */
export function monthlyReport({
  sessions,
  month,
  unit,
  library,
  firstDayOfWeek,
}: {
  sessions: readonly Session[];
  month: YearMonth;
  unit: WeightUnit;
  library: readonly {
    name: string;
    muscles: readonly string[];
    category?: string;
  }[];
  firstDayOfWeek: DayOfWeek;
}): MonthlyReport {
  const start = month.atDay(1);
  const end = month.atEndOfMonth();
  const inMonth = sessions
    .filter((s) => !s.date.isBefore(start) && !s.date.isAfter(end))
    .filter(isDone)
    .sort((a, b) => a.date.compareTo(b.date));

  let sets = 0;
  let volume = new BigNumber(0);
  let timeTrained = Duration.ZERO;
  const perWeek = new Map<string, number>();
  const perName = new Map<string, number>();
  for (const session of inMonth) {
    timeTrained = timeTrained.plus(session.duration ?? Duration.ZERO);
    const week = session.date
      .with(TemporalAdjusters.previousOrSame(firstDayOfWeek))
      .toString();
    perWeek.set(week, (perWeek.get(week) ?? 0) + 1);
    perName.set(
      session.blueprint.name,
      (perName.get(session.blueprint.name) ?? 0) + 1,
    );
    for (const exercise of session.recordedExercises) {
      if (exercise instanceof RecordedCardioExercise) {
        sets += exercise.sets.filter((s) => s.completionDateTime).length;
        continue;
      }
      for (const potentialSet of exercise.potentialSets) {
        const reps = potentialSet.set?.repsCompleted;
        if (!potentialSet.set) {
          continue;
        }
        sets += 1;
        volume = volume.plus(
          potentialSet.weight.convertTo(unit).value.multipliedBy(reps ?? 0),
        );
      }
    }
  }

  const gaps = muscleGaps({
    sessions: inMonth,
    library,
    today: end,
    from: start,
  });
  const worked = muscleGapRegions.filter((r) => gaps[r] > 0);

  const withBodyweight = inMonth.filter((s) => s.bodyweight);

  return {
    month,
    workouts: inMonth.length,
    weeksWithThreeOrMore: [...perWeek.values()].filter((n) => n >= 3).length,
    sets,
    volume: new Weight(volume, unit),
    timeTrained,
    bests: monthBests(sessions, inMonth, start, unit),
    mostWorked: [...worked]
      .sort((a, b) => gaps[b] - gaps[a])
      .slice(0, listedMuscles),
    barelyReached: muscleGapRegions
      .filter((r) => gaps[r] < wellTrainedSets)
      .sort((a, b) => gaps[a] - gaps[b])
      .slice(0, listedMuscles),
    bodyweightStart: withBodyweight.at(0)?.bodyweight,
    bodyweightEnd:
      withBodyweight.length > 1 ? withBodyweight.at(-1)?.bodyweight : undefined,
    byName: [...perName.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
}

function heaviestByLift(
  sessions: readonly Session[],
  unit: WeightUnit,
): Map<string, { name: string; weight: Weight }> {
  const heaviest = new Map<string, { name: string; weight: Weight }>();
  for (const session of sessions) {
    for (const exercise of session.recordedExercises) {
      if (!(exercise instanceof RecordedWeightedExercise)) {
        continue;
      }
      const key = new NormalizedName(exercise.blueprint.name).toString();
      for (const potentialSet of exercise.potentialSets) {
        if (!potentialSet.set?.repsCompleted) {
          continue;
        }
        const weight = potentialSet.weight.convertTo(unit);
        const current = heaviest.get(key);
        if (!current || weight.value.isGreaterThan(current.weight.value)) {
          heaviest.set(key, { name: exercise.blueprint.name, weight });
        }
      }
    }
  }
  return heaviest;
}

function monthBests(
  sessions: readonly Session[],
  inMonth: readonly Session[],
  start: LocalDate,
  unit: WeightUnit,
): MonthlyBest[] {
  const before = heaviestByLift(
    sessions.filter((s) => s.date.isBefore(start)),
    unit,
  );
  const bests: (MonthlyBest & { gain: number })[] = [];
  for (const [key, now] of heaviestByLift(inMonth, unit)) {
    const previous = before.get(key)?.weight;
    if (
      !previous ||
      previous.value.isZero() ||
      !now.weight.value.isGreaterThan(previous.value)
    ) {
      continue;
    }
    bests.push({
      name: now.name,
      weight: now.weight,
      previous,
      gain: now.weight.value.dividedBy(previous.value).toNumber(),
    });
  }
  return bests
    .sort((a, b) => b.gain - a.gain)
    .slice(0, listedBests)
    .map(({ gain: _gain, ...best }) => best);
}
