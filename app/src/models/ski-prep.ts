import BigNumber from 'bignumber.js';
import { LocalDate } from '@js-joda/core';
import {
  CardioExerciseBlueprint,
  IncreaseAllEvenlyProgressiveOverload,
  NormalizedName,
  Rest,
  SessionBlueprint,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import { ExerciseDescriptor } from '@/models/exercise-models';
import { isPausedGroup } from '@/models/injury/paused-group';
import { ROLLED_OVER_GROUP } from '@/models/roll-over';

/** Group of the lifts ski prep adds to Legs day; never written to the plan. */
export const SKI_GROUP = 'ski-prep';

export interface SkiExercise {
  name: string;
  sets: number;
  reps: number;
  notes: string;
  /** Weight step per progression, in the user's unit; 0 for bodyweight. */
  increment: number;
}

/**
 * Lifts for the demands skiing makes that a size-and-strength Legs day barely
 * trains: long holds in a half squat, side-to-side strength and landings,
 * loaded lowering, balance on one leg, and a trunk that resists twisting.
 * Names match the library where it already has the lift.
 */
export const skiExercises: SkiExercise[] = [
  {
    name: 'Wall Sit',
    sets: 3,
    reps: 1,
    notes: 'Hold 45 to 90 s, thighs near parallel.',
    increment: 0,
  },
  {
    name: 'Lateral Lunge',
    sets: 3,
    reps: 10,
    notes: 'Each side.',
    increment: 0,
  },
  {
    name: 'Lateral Bound',
    sets: 3,
    reps: 12,
    notes: 'Skater jumps: land on one leg and hold it a moment.',
    increment: 0,
  },
  {
    name: 'Goblet Squat',
    sets: 3,
    reps: 8,
    notes: 'Lower over 4 s.',
    increment: 2,
  },
  {
    name: 'Kettlebell One-Legged Deadlift',
    sets: 3,
    reps: 8,
    notes: 'Each side.',
    increment: 2,
  },
  {
    name: 'Pallof Press',
    sets: 3,
    reps: 10,
    notes: 'Each side. Keep the hands from turning toward the cable.',
    increment: 2.5,
  },
];

/** A Legs day is a workout with "leg" or "legs" as a word in its name. */
export function isLegDay(sessionName: string): boolean {
  return /\blegs?\b/i.test(sessionName);
}

/** Ski prep runs until its end date and is off from that day on. */
export function isSkiPrepActive(
  until: string | undefined,
  today: LocalDate,
): boolean {
  if (!until) {
    return false;
  }
  try {
    return today.isBefore(LocalDate.parse(until));
  } catch {
    // A malformed stored date switches it off rather than breaking every
    // workout and the screen that could clear it
    return false;
  }
}

/** The end date the switch starts with: the coming 3 January. */
export function defaultSkiPrepUntil(today: LocalDate): string {
  const thisYear = LocalDate.of(today.year(), 1, 3);
  return (
    today.isBefore(thisYear) ? thisYear : thisYear.plusYears(1)
  ).toString();
}

function toBlueprint(x: SkiExercise): WeightedExerciseBlueprint {
  return new WeightedExerciseBlueprint(
    x.name,
    x.sets,
    x.reps,
    new IncreaseAllEvenlyProgressiveOverload(BigNumber(x.increment)),
    Rest.short,
    false,
    x.notes,
    '',
    SKI_GROUP,
  );
}

/**
 * Adds the ski block to a Legs day, first in the workout proper: after Warm
 * Up, Mobility and any Rehab block, ahead of the planned and rolled-over
 * lifts. Lifts the plan already has are not added twice.
 */
export function withSkiBlock(blueprint: SessionBlueprint): SessionBlueprint {
  if (
    !isLegDay(blueprint.name) ||
    blueprint.exercises.some((x) => x.group === SKI_GROUP)
  ) {
    return blueprint;
  }
  const planned = new Set(
    blueprint.exercises.map((x) =>
      NormalizedName.fromExerciseBlueprint(x).toString(),
    ),
  );
  const toAdd = skiExercises
    .map(toBlueprint)
    .filter(
      (x) => !planned.has(NormalizedName.fromExerciseBlueprint(x).toString()),
    );
  const insertAt = blueprint.exercises.findIndex(
    (x) =>
      !(x instanceof CardioExerciseBlueprint) &&
      (!x.group || x.group === ROLLED_OVER_GROUP || isPausedGroup(x.group)),
  );
  const at = insertAt === -1 ? blueprint.exercises.length : insertAt;
  return blueprint.with({
    exercises: [
      ...blueprint.exercises.slice(0, at),
      ...toAdd,
      ...blueprint.exercises.slice(at),
    ],
  });
}

/** Library entries for the ski lifts the bundled library does not have. */
export function skiDescriptors(): ExerciseDescriptor[] {
  return [
    {
      name: 'Wall Sit',
      force: 'static',
      level: 'beginner',
      mechanic: 'isolation',
      equipment: 'body only',
      muscles: ['quadriceps', 'glutes'],
      instructions:
        'Back flat against a wall, slide down until the thighs are near parallel to the floor, and hold.',
      category: 'strength',
    },
    {
      name: 'Lateral Lunge',
      force: 'push',
      level: 'beginner',
      mechanic: 'compound',
      equipment: 'body only',
      muscles: ['quadriceps', 'glutes', 'adductors', 'hamstrings'],
      instructions:
        'Step wide to one side, bend that knee and sit the hips back with the other leg straight, then push back to standing.',
      category: 'strength',
    },
  ];
}
