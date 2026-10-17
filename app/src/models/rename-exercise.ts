import {
  ExerciseBlueprint,
  NormalizedName,
  ProgramBlueprint,
  SessionBlueprint,
} from '@/models/blueprint-models';
import {
  RecordedExercise,
  RecordedWeightedExercise,
  Session,
} from '@/models/session-models';

/**
 * Renaming a lift rewrites every place it is named, so its history, PREVIOUS,
 * bests and notes follow the new name. Names match the way history does: by
 * normalized name, so case, spacing and plurals do not matter.
 */
export interface ExerciseRename {
  from: string;
  to: string;
}

const matches = (name: string, rename: ExerciseRename) =>
  new NormalizedName(name).equals(new NormalizedName(rename.from));

function renamedBlueprint<T extends ExerciseBlueprint>(
  x: T,
  rename: ExerciseRename,
): T {
  return matches(x.name, rename) ? (x.with({ name: rename.to }) as T) : x;
}

function renamedRecorded(
  x: RecordedExercise,
  rename: ExerciseRename,
): RecordedExercise {
  if (!matches(x.blueprint.name, rename)) {
    return x;
  }
  return x instanceof RecordedWeightedExercise
    ? x.with({ blueprint: renamedBlueprint(x.blueprint, rename) })
    : x.with({ blueprint: renamedBlueprint(x.blueprint, rename) });
}

export function renameInSessionBlueprint(
  blueprint: SessionBlueprint,
  rename: ExerciseRename,
): SessionBlueprint {
  if (!blueprint.exercises.some((x) => matches(x.name, rename))) {
    return blueprint;
  }
  return blueprint.with({
    exercises: blueprint.exercises.map((x) => renamedBlueprint(x, rename)),
  });
}

/** The same session object when the lift is not in it. */
export function renameInSession(
  session: Session,
  rename: ExerciseRename,
): Session {
  if (
    !session.recordedExercises.some((x) => matches(x.blueprint.name, rename))
  ) {
    return session;
  }
  return session.with({
    blueprint: renameInSessionBlueprint(session.blueprint, rename),
    recordedExercises: session.recordedExercises.map((x) =>
      renamedRecorded(x, rename),
    ),
  });
}

/** The same program object when the lift is not in it. */
export function renameInProgram(
  program: ProgramBlueprint,
  rename: ExerciseRename,
): ProgramBlueprint {
  const sessions = program.sessions.map((x) =>
    renameInSessionBlueprint(x, rename),
  );
  return sessions.every((x, i) => x === program.sessions[i])
    ? program
    : program.with({ sessions });
}
