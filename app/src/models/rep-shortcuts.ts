/**
 * The shortcut buttons in the reps dialog: five either side of the reps done
 * in the set above, or of the target when there is no finished set above.
 * Negative reps don't exist, so the low end stops at 0.
 */
export function repShortcuts({
  repsAbove,
  repTarget,
}: {
  repsAbove: number | undefined;
  repTarget: number;
}): number[] {
  const center = repsAbove ?? repTarget;
  const lowest = Math.max(0, center - 5);
  return Array.from({ length: center + 5 - lowest + 1 }, (_, i) => lowest + i);
}
