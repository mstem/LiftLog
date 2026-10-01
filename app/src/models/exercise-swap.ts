import {
  SessionBlueprint,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import { RecordedWeightedExercise, Session } from '@/models/session-models';
import { Weight } from '@/models/weight';

/** A lift swapped in for this workout, and the planned lift it stands in for */
export interface ExerciseSwap {
  swappedIn: string;
  original: WeightedExerciseBlueprint;
}

/**
 * Swaps a different lift into a slot for this workout only. Sets, rep target,
 * rest, superset link and group stay as planned; notes and the link belonged to
 * the planned lift. Every set takes the swapped-in lift's last weight, or keeps
 * the planned weight when it has none.
 *
 * Only before any set of the slot is ticked: done sets must stay recorded
 * against the lift that was actually done.
 */
export function swapExercise(
  session: Session,
  index: number,
  name: string,
  lastWeight: Weight | undefined,
): Session {
  const exercise = session.recordedExercises[index];
  if (!(exercise instanceof RecordedWeightedExercise)) {
    throw new Error('Only weighted exercises can be swapped');
  }
  if (exercise.isStarted) {
    throw new Error('Cannot swap an exercise once a set is ticked');
  }
  const blueprint = exercise.blueprint.with({ name, notes: '', link: '' });
  return session
    .with({
      blueprint: session.blueprint.with({
        exercises: session.blueprint.exercises.with(index, blueprint),
      }),
    })
    .withExercise(
      index,
      exercise
        .with({ blueprint })
        .withAllSets((s) => (lastWeight ? s.with({ weight: lastWeight }) : s)),
    );
}

/**
 * The workout as planned: each swapped-in lift replaced by the lift it stood in
 * for, found by name so later edits to the workout do not misplace it.
 */
export function undoSwaps(
  blueprint: SessionBlueprint,
  swaps: readonly ExerciseSwap[],
): SessionBlueprint {
  if (!swaps.length) {
    return blueprint;
  }
  return blueprint.with({
    exercises: blueprint.exercises.map(
      (x) => swaps.find((s) => s.swappedIn === x.name)?.original ?? x,
    ),
  });
}
