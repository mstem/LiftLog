export interface SupersetPosition {
  /** Which superset in the list this is, so neighbouring ones can be told apart */
  chain: number;
  isFirst: boolean;
  isLast: boolean;
}

/**
 * Works out which exercises belong to a superset, from the per-exercise
 * "supersets with the next one" links.
 *
 * A run of consecutive links is one superset, so `[true, true, false]` is a
 * single chain of three exercises rather than two chains of two. Exercises
 * outside any chain get `undefined` - a lone exercise is not a superset, and
 * a link on the last exercise points at nothing.
 */
export function groupSupersets(
  linksToNext: readonly boolean[],
): (SupersetPosition | undefined)[] {
  const positions: (SupersetPosition | undefined)[] = linksToNext.map(
    () => undefined,
  );
  let chain = 0;
  let start = 0;
  while (start < linksToNext.length) {
    let end = start;
    while (end < linksToNext.length - 1 && linksToNext[end]) {
      end++;
    }
    if (end > start) {
      for (let i = start; i <= end; i++) {
        positions[i] = { chain, isFirst: i === start, isLast: i === end };
      }
      chain++;
    }
    start = end + 1;
  }
  return positions;
}
