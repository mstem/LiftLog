/**
 * The shortcut buttons in the reps dialog: 11 in a row, five either side of
 * `center`. Negative reps don't exist, so near 0 the row starts at 0 and
 * shifts up instead of shrinking, which keeps the row 11 buttons wide.
 */
export function repShortcuts(center: number): number[] {
  const lowest = Math.max(0, center - 5);
  return Array.from({ length: 11 }, (_, i) => lowest + i);
}

/**
 * What the shortcut row centers on: the set's own reps when it has any, else
 * the reps of the nearest earlier set ticked today, else the number the REPS
 * cell shows (last time's reps or the target).
 */
export function repShortcutCenter({
  ownReps,
  repsAbove,
  cellReps,
}: {
  ownReps: number | undefined;
  repsAbove: number | undefined;
  cellReps: number;
}): number {
  return ownReps ?? repsAbove ?? cellReps;
}

/** Reps of the nearest set above `index` that is ticked. */
export function repsBefore(
  sets: readonly { set?: { repsCompleted: number } | undefined }[],
  index: number,
): number | undefined {
  for (let i = index - 1; i >= 0; i--) {
    const reps = sets[i]?.set?.repsCompleted;
    if (reps !== undefined) {
      return reps;
    }
  }
  return undefined;
}
