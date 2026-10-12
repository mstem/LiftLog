import { NormalizedName } from '@/models/blueprint-models';
import library from '../../../assets/exercises.json';

/**
 * Positions the shoulder rehab protocols treat with care: overhead pressing,
 * behind-the-neck work, horizontal pressing and dips, and upright rows (end-range
 * internal rotation). Flagged by position, not by muscle (spec section 3).
 */
const namePatterns = [
  /overhead/,
  /military/,
  /shoulder press/,
  /behind (the )?neck/,
  /upright .*row/,
  /\bdips?\b/,
  /bench press/,
  /floor press/,
  /push press/,
  /arnold/,
];

// Built on first use: the library JSON is large and this module sits on the
// startup path through the session service.
let pushShoulderPrimary: Set<string> | undefined;

function getPushShoulderPrimary(): Set<string> {
  pushShoulderPrimary ??= new Set(
    (
      library as {
        exercises: {
          name: string;
          force: string | null;
          primaryMuscles: string[];
        }[];
      }
    ).exercises
      .filter(
        (x) => x.force === 'push' && x.primaryMuscles.includes('shoulders'),
      )
      .map((x) => x.name.toLowerCase()),
  );
  return pushShoulderPrimary;
}

export function isShoulderLoaded(
  name: string,
  overrides: Record<string, boolean>,
): boolean {
  const override = overrides[new NormalizedName(name).toString()];
  if (override !== undefined) {
    return override;
  }
  const lower = name.toLowerCase();
  return (
    namePatterns.some((p) => p.test(lower)) ||
    getPushShoulderPrimary().has(lower)
  );
}
