/**
 * The shortcut buttons in the reps dialog: 11 in a row, five either side of
 * the reps done in an earlier set, or of the target when no earlier set is
 * done. Negative reps don't exist, so near 0 the row shifts up instead of
 * shrinking, which keeps every button in the same place from set to set.
 */
export function repShortcuts({
  repsAbove,
  repTarget,
}: {
  repsAbove: number | undefined;
  repTarget: number;
}): number[] {
  const lowest = Math.max(0, (repsAbove ?? repTarget) - 5);
  return Array.from({ length: 11 }, (_, i) => lowest + i);
}

/**
 * Reps of the nearest set above `index` that has any: ticked reps first,
 * else reps typed into an unticked set.
 */
export function repsBefore(
  sets: readonly { set?: { repsCompleted: number } | undefined }[],
  pendingReps: Readonly<Record<number, number | undefined>>,
  index: number,
): number | undefined {
  for (let i = index - 1; i >= 0; i--) {
    const reps = sets[i]?.set?.repsCompleted ?? pendingReps[i];
    if (reps !== undefined) {
      return reps;
    }
  }
  return undefined;
}
