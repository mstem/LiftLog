import {
  CardioExerciseBlueprint,
  NormalizedName,
  SessionBlueprint,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import { RecordedWeightedExercise, Session } from '@/models/session-models';

/**
 * Group given to lifts carried over from the previous workout. Reusing the
 * exercise group keeps them a titled block on screen and needs no new stored
 * field; the group is also how they are told apart from planned exercises.
 */
export const ROLLED_OVER_GROUP = 'Rolled over';

/**
 * The lifts from a finished workout that should carry into the next one: those
 * with no set ticked. Grouped exercises (Mobility, and lifts that already
 * rolled over once) and cardio repeat anyway, so they never carry.
 */
export function rolledOverExercises(
  previous: Session,
): WeightedExerciseBlueprint[] {
  return previous.recordedExercises
    .filter(
      (x): x is RecordedWeightedExercise =>
        x instanceof RecordedWeightedExercise &&
        !x.blueprint.group &&
        x.potentialSets.every((s) => !s.set),
    )
    .map((x) => x.blueprint);
}

/**
 * Places carried-over lifts after the workout's opening warm-up block (its
 * leading cardio and grouped exercises), skipping any the workout already has.
 */
export function withRolledOverExercises(
  next: SessionBlueprint,
  exercises: readonly WeightedExerciseBlueprint[],
): SessionBlueprint {
  const planned = new Set(
    next.exercises.map((x) =>
      NormalizedName.fromExerciseBlueprint(x).toString(),
    ),
  );
  const toAdd = exercises
    .filter(
      (x) => !planned.has(NormalizedName.fromExerciseBlueprint(x).toString()),
    )
    .map((x) => x.with({ group: ROLLED_OVER_GROUP, supersetWithNext: false }));
  if (!toAdd.length) {
    return next;
  }

  const warmUpEnd = next.exercises.findIndex(
    (x) => !(x instanceof CardioExerciseBlueprint) && !x.group,
  );
  const insertAt = warmUpEnd === -1 ? next.exercises.length : warmUpEnd;
  return next.with({
    exercises: [
      ...next.exercises.slice(0, insertAt),
      ...toAdd,
      ...next.exercises.slice(insertAt),
    ],
  });
}

/** The workout as planned, without anything carried over into it. */
export function withoutRolledOverExercises(
  session: SessionBlueprint,
): SessionBlueprint {
  return session.with({
    exercises: session.exercises.filter((x) => x.group !== ROLLED_OVER_GROUP),
  });
}
