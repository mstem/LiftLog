import { fuzzyMatchScore } from '@/components/presentation/workout-editor/exercise-fuzzy-match';

// Enough to lift a lift already in the log above unlogged variants that
// match the same letters, without lifting a poor match over a good one.
const loggedBonus = 3;

/**
 * Lowercased names of lifts with at least one set done. A planned lift that
 * was skipped every time stays in each session's list, so it is left out.
 */
export function loggedExerciseNames(
  sessions: readonly {
    recordedExercises: readonly {
      isStarted: boolean;
      blueprint: { name: string };
    }[];
  }[],
): Set<string> {
  return new Set(
    sessions.flatMap((s) =>
      s.recordedExercises
        .filter((x) => x.isStarted)
        .map((x) => x.blueprint.name.toLowerCase()),
    ),
  );
}

/** Library lifts matching a typed search, best first, logged lifts lifted. */
export function searchSwapOptions<T extends { name: string }>(args: {
  search: string;
  library: readonly T[];
  logged: ReadonlySet<string>;
  exclude: string | undefined;
  limit: number;
}): T[] {
  const exclude = args.exclude?.toLowerCase();
  return args.library
    .filter((x) => x.name.toLowerCase() !== exclude)
    .flatMap((x) => {
      const score = fuzzyMatchScore(args.search, x.name);
      if (score === null) {
        return [];
      }
      const bonus = args.logged.has(x.name.toLowerCase()) ? loggedBonus : 0;
      return [{ x, score: score + bonus }];
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, args.limit)
    .map(({ x }) => x);
}
