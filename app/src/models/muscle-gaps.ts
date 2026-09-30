import { LocalDate } from '@js-joda/core';
import {
  RecordedCardioExercise,
  RecordedWeightedExercise,
  Session,
} from '@/models/session-models';

/** Regions of the body diagram, named as react-native-body-highlighter names them */
export const muscleGapRegions = [
  'abs',
  'obliques',
  'chest',
  'deltoids',
  'biceps',
  'triceps',
  'forearm',
  'trapezius',
  'upper-back',
  'lower-back',
  'neck',
  'gluteal',
  'quadriceps',
  'hamstring',
  'adductors',
  'calves',
] as const;
export type MuscleGapRegion = (typeof muscleGapRegions)[number];

/** Weighted sets in the window at which a muscle counts as well trained */
export const wellTrainedSets = 20;
const windowDays = 30;
/** Bodyweight and Mobility sets count for less than a loaded set */
const bodyweightSetValue = 0.5;

/**
 * Muscle names, from the exercise library and the map below, to diagram
 * regions. The diagram has no hip-flexor or abductor region, and draws lats and
 * middle back as one upper back.
 */
const regionsForMuscle: Record<string, MuscleGapRegion[]> = {
  abdominals: ['abs', 'obliques'],
  abs: ['abs'],
  obliques: ['obliques'],
  abductors: ['gluteal'],
  adductors: ['adductors'],
  biceps: ['biceps'],
  calves: ['calves'],
  chest: ['chest'],
  forearms: ['forearm'],
  glutes: ['gluteal'],
  hamstrings: ['hamstring'],
  'hip flexors': ['quadriceps'],
  lats: ['upper-back'],
  'lower back': ['lower-back'],
  'middle back': ['upper-back'],
  neck: ['neck'],
  quadriceps: ['quadriceps'],
  shoulders: ['deltoids'],
  traps: ['trapezius'],
  triceps: ['triceps'],
  'upper back': ['upper-back'],
};

/**
 * Muscles for exercises in Matt's plan whose names are not in the exercise
 * library: Hevy-import lift names and his own bodyweight mobility moves.
 */
const musclesByExerciseName: Record<string, string[]> = {
  'bench press (barbell)': ['chest', 'triceps', 'shoulders'],
  'bulgarian split squat': ['quadriceps', 'glutes', 'hamstrings'],
  'cable fly crossovers': ['chest'],
  'decline bench press (barbell)': ['chest', 'triceps'],
  'hip thrust (machine)': ['glutes', 'hamstrings'],
  'incline bench press (barbell)': ['chest', 'shoulders', 'triceps'],
  'push up': ['chest', 'triceps', 'shoulders'],
  'rotator cuff cable warm-up': ['shoulders'],
  'single arm cable crossover': ['chest'],
  'squat jump': ['quadriceps', 'glutes', 'calves'],
  'triceps kickback (cable)': ['triceps'],
  cycling: ['quadriceps', 'calves'],
  'high knee skips': ['hip flexors', 'quadriceps', 'calves'],
  'high kicks': ['hip flexors', 'hamstrings'],
  '90 90s': ['glutes', 'adductors', 'abductors'],
  kickover: ['glutes', 'lower back'],
  'on back leg crossover': ['glutes', 'lower back'],
  'hamstring extension': ['hamstrings'],
  pigeon: ['glutes'],
  'quad lunge 3-way stretch': ['quadriceps', 'hip flexors'],
  'lizard elbow extensions': ['hip flexors', 'adductors', 'glutes'],
  'squat arrow shoots': ['quadriceps', 'glutes', 'shoulders'],
  'side lunges low hips': ['glutes', 'adductors', 'quadriceps'],
  'seated palms up wrist curl': ['forearms'],
  plank: ['abs', 'obliques'],
  'side plank': ['obliques'],
  'ab wheel': ['abs'],
  'glute bridge': ['glutes', 'hamstrings'],
  'bird dog': ['lower back', 'glutes', 'abs'],
  swimmer: ['lower back', 'glutes', 'shoulders'],
  'pogo hops': ['calves'],
};

const nameKey = (name: string) => name.trim().toLowerCase();

/**
 * Weighted sets per diagram region over the last 30 days: each ticked set
 * counts once for every region its exercise works, bodyweight, timed and
 * Mobility sets at half.
 */
export function muscleGaps({
  sessions,
  library,
  today,
}: {
  sessions: readonly Session[];
  library: readonly { name: string; muscles: readonly string[] }[];
  today: LocalDate;
}): Record<MuscleGapRegion, number> {
  const libraryMuscles = new Map(
    library.map((x) => [nameKey(x.name), x.muscles]),
  );
  const totals = Object.fromEntries(
    muscleGapRegions.map((r) => [r, 0]),
  ) as Record<MuscleGapRegion, number>;
  const since = today.minusDays(windowDays);

  for (const session of sessions) {
    if (!session.date.isAfter(since)) {
      continue;
    }
    for (const exercise of session.recordedExercises) {
      const key = nameKey(exercise.blueprint.name);
      const muscles =
        musclesByExerciseName[key] ?? libraryMuscles.get(key) ?? [];
      const regions = new Set(
        muscles.flatMap((m) => regionsForMuscle[m] ?? []),
      );
      if (!regions.size) {
        continue;
      }
      const value = setValue(exercise);
      for (const region of regions) {
        totals[region] += value;
      }
    }
  }
  return totals;
}

function setValue(exercise: RecordedWeightedExercise | RecordedCardioExercise) {
  if (exercise instanceof RecordedCardioExercise) {
    return (
      exercise.sets.filter((s) => s.completionDateTime).length *
      bodyweightSetValue
    );
  }
  const mobility = exercise.blueprint.group === 'Mobility';
  return exercise.potentialSets
    .filter((s) => s.set)
    .reduce(
      (sum, s) =>
        sum + (mobility || s.weight.value.isZero() ? bodyweightSetValue : 1),
      0,
    );
}

/** Colour step 1 (untrained, red) to 5 (well trained, green) */
export function muscleGapLevel(weightedSets: number): 1 | 2 | 3 | 4 | 5 {
  const steps = Math.floor(
    (Math.min(weightedSets, wellTrainedSets) / wellTrainedSets) * 4,
  );
  return (1 + steps) as 1 | 2 | 3 | 4 | 5;
}
