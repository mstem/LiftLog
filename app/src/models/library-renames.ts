import { NormalizedName } from '@/models/blueprint-models';
import { ExerciseRename } from '@/models/rename-exercise';

/**
 * Library lifts that moved to a new name. The library once held a few
 * suspension lifts as 'Suspended …' next to the TRX set; each now lives
 * under one TRX name. Installs that still have an old name rename it at
 * startup, which carries its history, plans and notes over.
 */
export const libraryRenames: readonly ExerciseRename[] = [
  { from: 'Suspended Row', to: 'TRX Row' },
  { from: 'Suspended Push-Up', to: 'TRX Push-Up' },
  { from: 'Suspended Split Squat', to: 'TRX Suspended Lunge' },
  { from: 'Suspended Reverse Crunch', to: 'TRX Knee Tuck' },
  { from: 'Suspended Fallout', to: 'TRX Fallout' },
];

/** The renames whose old name still appears among `names`. */
export function pendingLibraryRenames(
  names: Iterable<string>,
  renames: readonly ExerciseRename[] = libraryRenames,
): ExerciseRename[] {
  const present = new Set(
    [...names].map((x) => new NormalizedName(x).toString()),
  );
  return renames.filter((x) =>
    present.has(new NormalizedName(x.from).toString()),
  );
}
