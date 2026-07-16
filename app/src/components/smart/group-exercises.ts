import { RecordedExercise } from '@/models/session-models';

export interface ExerciseSegment {
  key: string;
  group: string | undefined;
  entries: { exercise: RecordedExercise; index: number }[];
}

/**
 * Splits a session's exercises into consecutive runs sharing a `group`.
 * Entries keep their original index, since that is what every edit callback
 * writes back through - grouping must not renumber the exercises.
 *
 * Only adjacent exercises merge: two separated runs of the same group name stay
 * separate sections, so a group can never reorder the session.
 */
export function groupExercises(
  exercises: readonly RecordedExercise[],
): ExerciseSegment[] {
  const segments: ExerciseSegment[] = [];
  exercises.forEach((exercise, index) => {
    // Empty string means ungrouped - the editor clears the field to ''.
    const group = exercise.blueprint.group || undefined;
    const current = segments.at(-1);
    if (current && current.group === group) {
      current.entries.push({ exercise, index });
      return;
    }
    segments.push({
      key: `${group ?? '__ungrouped__'}-${index}`,
      group,
      entries: [{ exercise, index }],
    });
  });
  return segments;
}
