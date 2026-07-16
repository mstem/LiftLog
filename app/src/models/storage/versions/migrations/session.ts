import { createMigrations } from '@/models/storage/versions/migrations/migrator';
import { addProgressiveOverloadToExercise } from '@/models/storage/versions/migrations/steps/add-progressive-overload';
import { addGroupToExercise } from '@/models/storage/versions/migrations/steps/add-exercise-group';
import { SessionJSON } from '@/models/storage/versions/v1';
import { omit } from '@/utils/omit';

export const sessionMigrations = createMigrations<SessionJSON>()
  .add((session) => ({
    ...session,
    version: 2,
    blueprint: omit('exercises', session.blueprint), // Don't need to store it twice
    recordedExercises: session.recordedExercises.map((ex) =>
      ex.type === 'RecordedCardioExercise'
        ? ex
        : {
            ...ex,
            blueprint: addProgressiveOverloadToExercise(ex.blueprint),
          },
    ),
  }))
  .add((session) => ({
    ...session,
    version: 3 as const,
    // Branch on the discriminator so each recorded exercise stays correlated
    // with its own blueprint type - a single map over the union would widen
    // every blueprint to `Cardio | Weighted`.
    recordedExercises: session.recordedExercises.map((ex) =>
      ex.type === 'RecordedCardioExercise'
        ? { ...ex, blueprint: addGroupToExercise(ex.blueprint) }
        : { ...ex, blueprint: addGroupToExercise(ex.blueprint) },
    ),
  }))
  .build();
