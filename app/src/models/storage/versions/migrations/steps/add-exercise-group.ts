/**
 * Exercises gain an optional `group`. Consecutive exercises sharing a group name
 * render as one collapsible block in a session; `undefined` means ungrouped, so
 * every pre-existing exercise keeps rendering exactly as it did.
 */

/**
 * Distributes over the exercise union so the `type` discriminator survives -
 * a non-distributive `(Weighted | Cardio) & { group }` would defeat narrowing.
 */
type WithGroup<T> = T extends unknown
  ? T & { group: string | undefined }
  : never;

export function addGroupToExercise<T extends { type: string }>(
  exercise: T,
): WithGroup<T> {
  return { ...exercise, group: undefined } as WithGroup<T>;
}
