import BigNumber from 'bignumber.js';
import {
  IncreaseAllEvenlyProgressiveOverload,
  NormalizedName,
  Rest,
  SessionBlueprint,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import { RecordedWeightedExercise, Session } from '@/models/session-models';
import { ExerciseDescriptor } from '@/models/exercise-models';

/**
 * Group id of the injected rehab block. Reserved so a group the user names
 * "Rehab" is never mistaken for it; shown as the translated "Rehab" label.
 */
export const REHAB_GROUP = 'injury-mode:rehab';

/**
 * Group typed into the exercise editor's group box, which shows the rehab
 * block by its label. Typing back to that label keeps the reserved id; any
 * other text is an ordinary group.
 */
export function groupFromInput(
  text: string,
  startedAsRehab: boolean,
  rehabLabel: string,
): string {
  return startedAsRehab && text === rehabLabel ? REHAB_GROUP : text;
}

export interface RehabExercise {
  name: string;
  structures: string[];
  sets: number;
  reps: number;
  notes: string;
  source: string;
  /** library muscle names, for the exercise list */
  muscles: string[];
  equipment: string | null;
  /**
   * Weight step after a pain stop or two passed sessions, in the user's unit.
   * Dumbbell lifts step by 1; bodyweight and band lifts are 0 (changed by hand).
   */
  increment: number;
}

const stretch = 'Cross-body posterior shoulder stretch';

export const rehabExercises: RehabExercise[] = [
  {
    name: 'Isometric abduction, wall',
    structures: ['supraspinatus'],
    sets: 3,
    reps: 10,
    notes: 'Press the back of the hand into a wall, 5 s holds.',
    source: 'Littlewood',
    muscles: ['shoulders'],
    equipment: 'body only',
    increment: 0,
  },
  {
    name: 'Abduction 80 to 120 degrees, dumbbell',
    structures: ['supraspinatus', 'deltoid'],
    sets: 3,
    reps: 10,
    notes: 'Raise only through 80 to 120 degrees.',
    source: 'Littlewood',
    muscles: ['shoulders'],
    equipment: 'dumbbell',
    increment: 1,
  },
  {
    name: 'Eccentric full can',
    structures: ['supraspinatus'],
    sets: 3,
    reps: 15,
    notes: 'Thumb up, lower over 3 s.',
    source: 'Holmgren',
    muscles: ['shoulders'],
    equipment: 'dumbbell',
    increment: 1,
  },
  {
    name: 'Side-lying external rotation, dumbbell',
    structures: ['infraspinatus', 'teres minor', 'lower trapezius'],
    sets: 3,
    reps: 15,
    notes: '',
    source: 'Holmgren, Cools',
    muscles: ['shoulders'],
    equipment: 'dumbbell',
    increment: 1,
  },
  {
    name: 'Banded eccentric external rotation',
    structures: ['infraspinatus', 'teres minor'],
    sets: 3,
    reps: 15,
    notes: 'Lower over 3 s.',
    source: 'Holmgren',
    muscles: ['shoulders'],
    equipment: 'bands',
    increment: 0,
  },
  {
    name: 'Low row, isometric',
    structures: ['rhomboids', 'middle trapezius', 'lower trapezius'],
    sets: 3,
    reps: 20,
    notes: '',
    source: 'RoCTEx, Cools',
    muscles: ['middle back'],
    equipment: 'body only',
    increment: 0,
  },
  {
    name: 'Push-up plus, elbows',
    structures: ['serratus anterior'],
    sets: 3,
    reps: 20,
    notes: 'From the elbows, push the shoulder blades apart at the top.',
    source: 'RoCTEx, Cools',
    muscles: ['chest', 'shoulders'],
    equipment: 'body only',
    increment: 0,
  },
  {
    name: 'Supine punch',
    structures: ['serratus anterior'],
    sets: 3,
    reps: 15,
    notes: '',
    source: 'Cools',
    muscles: ['chest', 'shoulders'],
    equipment: 'dumbbell',
    increment: 1,
  },
  {
    name: 'Wall slide',
    structures: ['serratus anterior', 'lower trapezius'],
    sets: 3,
    reps: 15,
    notes: '',
    source: 'Cools',
    muscles: ['shoulders', 'middle back'],
    equipment: 'body only',
    increment: 0,
  },
  {
    name: 'Prone horizontal abduction with external rotation',
    structures: ['lower trapezius', 'middle trapezius'],
    sets: 3,
    reps: 15,
    notes: '',
    source: 'Cools',
    muscles: ['middle back', 'shoulders'],
    equipment: 'dumbbell',
    increment: 1,
  },
  {
    name: 'Prone extension',
    structures: ['lower trapezius', 'middle trapezius'],
    sets: 3,
    reps: 15,
    notes: '',
    source: 'Cools',
    muscles: ['middle back'],
    equipment: 'dumbbell',
    increment: 1,
  },
  {
    name: 'Side-lying forward flexion',
    structures: ['lower trapezius'],
    sets: 3,
    reps: 15,
    notes: '',
    source: 'Cools',
    muscles: ['shoulders'],
    equipment: 'dumbbell',
    increment: 1,
  },
  {
    name: stretch,
    structures: ['posterior capsule'],
    sets: 3,
    reps: 1,
    notes: 'Hold 30 s.',
    source: 'Holmgren',
    muscles: ['shoulders'],
    equipment: 'body only',
    increment: 0,
  },
];

function toBlueprint(x: RehabExercise): WeightedExerciseBlueprint {
  return new WeightedExerciseBlueprint(
    x.name,
    x.sets,
    x.reps,
    new IncreaseAllEvenlyProgressiveOverload(BigNumber(x.increment)),
    Rest.short,
    false,
    `${x.notes} Source: ${x.source}.`.trim(),
    '',
    REHAB_GROUP,
  );
}

/**
 * The step injury mode uses for a Rehab lift. Read from the overload amount,
 * because weightIncrement turns a 0 into 2.5 and these lifts must stay put.
 */
export function rehabIncrement(x: WeightedExerciseBlueprint): BigNumber {
  return x.progressiveOverload instanceof IncreaseAllEvenlyProgressiveOverload
    ? x.progressiveOverload.amount
    : BigNumber(0);
}

export function withRehabBlock(
  blueprint: SessionBlueprint,
  structures: string[],
): SessionBlueprint {
  const hasWeighted = blueprint.exercises.some(
    (x) => x instanceof WeightedExerciseBlueprint && x.group !== REHAB_GROUP,
  );
  if (
    !hasWeighted ||
    blueprint.exercises.some((x) => x.group === REHAB_GROUP)
  ) {
    return blueprint;
  }
  const wanted = new Set(structures);
  const chosen = wanted.size
    ? rehabExercises.filter(
        (x) => x.name === stretch || x.structures.some((s) => wanted.has(s)),
      )
    : rehabExercises;
  const planned = new Set(
    blueprint.exercises.map((x) =>
      NormalizedName.fromExerciseBlueprint(x).toString(),
    ),
  );
  const toAdd = chosen
    .map(toBlueprint)
    .filter(
      (x) => !planned.has(NormalizedName.fromExerciseBlueprint(x).toString()),
    );
  return blueprint.with({ exercises: [...blueprint.exercises, ...toAdd] });
}

export function isRehabDone(session: Session): boolean {
  return session.recordedExercises.some(
    (x) =>
      x instanceof RecordedWeightedExercise &&
      x.blueprint.group === REHAB_GROUP &&
      x.potentialSets.some((s) => s.set !== undefined),
  );
}

export function rehabDescriptors(): ExerciseDescriptor[] {
  return rehabExercises.map((x) => ({
    name: x.name,
    force: null,
    level: 'beginner',
    mechanic: 'isolation',
    equipment: x.equipment,
    muscles: x.muscles,
    instructions:
      `${x.notes} Targets: ${x.structures.join(', ')}. Source: ${x.source}.`.trim(),
    category: 'strength',
  }));
}
