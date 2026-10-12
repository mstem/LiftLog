import { NormalizedName } from '@/models/blueprint-models';
import library from '../../../assets/exercises.json';

/**
 * Lifts that load an injured shoulder: pressing, overhead and hanging work,
 * pulling and rowing, flys and raises, weight on the hands, a barbell held on
 * the back, and curls (the biceps long head crosses the front of the shoulder).
 * Many user exercise names are not in the library, so names carry most of it.
 */
const namePatterns = [
  // Pressing and pushing
  /overhead/,
  /military/,
  /(shoulder|chest|bench|floor|push|incline|decline) press/,
  /arnold/,
  /\bdips?\b/,
  /push ?-?ups?\b/,
  /triceps? press|skull ?crusher|french press/,
  // Overhead pulling and hanging
  /(pull|chin) ?-?ups?\b/,
  /pull ?-?down/,
  /\bhang(ing)?\b/,
  // Rows, flys, raises and other shoulder-blade work
  /\brows?\b/,
  /\bfly(e|es|s)?\b|crossover|pec deck/,
  /(lateral|front|side|shoulder|rear delt|\by) raise/,
  /face pull|pull ?-?apart/,
  /shrug/,
  /pullover/,
  // Arms reaching overhead under load or body weight
  /ab (wheel|roll(er|out))|rollout/,
  /bird ?dog/,
  /(biceps?|chest|pec) stretch/,
  // A barbell held on the back puts the shoulder in an externally rotated reach
  /(barbell|back|high bar|low bar) squat|good morning/,
  // Curls, except wrist and leg curls
  /(?<!wrist |leg |hamstring )curls?\b/,
  /^seated biceps$/,
  /behind (the )?neck/,
  /upright .*row/,
];

/** Library muscles whose work moves or steadies the shoulder blade or joint. */
const shoulderMuscles = ['shoulders', 'lats', 'middle back', 'traps'];

// Built on first use: the library JSON is large and this module sits on the
// startup path through the session service.
let libraryShoulderLoaded: Set<string> | undefined;

// A library lift counts when a shoulder muscle is a main mover, or when it is
// a helper in a lift that moves load (stretches and holds are left out).
function getLibraryShoulderLoaded(): Set<string> {
  libraryShoulderLoaded ??= new Set(
    (
      library as {
        exercises: {
          name: string;
          force: string | null;
          primaryMuscles: string[];
          secondaryMuscles: string[];
        }[];
      }
    ).exercises
      .filter(
        (x) =>
          x.primaryMuscles.some((m) => shoulderMuscles.includes(m)) ||
          ((x.force === 'push' || x.force === 'pull') &&
            x.secondaryMuscles.includes('shoulders')),
      )
      .map((x) => x.name.toLowerCase()),
  );
  return libraryShoulderLoaded;
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
    getLibraryShoulderLoaded().has(lower)
  );
}
