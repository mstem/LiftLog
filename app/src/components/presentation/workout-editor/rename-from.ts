import { NormalizedName } from '@/models/blueprint-models';

/**
 * The name a rename rewrites, or undefined when the pencil should not show.
 * Renaming rewrites history, plans and notes, so it is offered only on a saved
 * lift that has history, and only while the editor still shows that lift. A
 * lift picked from search but not yet saved would rename the wrong history,
 * and a new placeholder such as 'Exercise 4' has no history to carry over.
 */
export function renameFrom(
  savedName: string | undefined,
  shownName: string,
  hasHistory: boolean,
): string | undefined {
  return hasHistory && savedName !== undefined && savedName === shownName
    ? savedName
    : undefined;
}

/** True when a set of the lift was done in any workout. */
export function hasLoggedHistory(
  sessions: readonly {
    recordedExercises: readonly {
      isStarted: boolean;
      blueprint: { name: string };
    }[];
  }[],
  name: string | undefined,
): boolean {
  if (name === undefined) {
    return false;
  }
  const key = new NormalizedName(name);
  return sessions.some((s) =>
    s.recordedExercises.some(
      (x) => x.isStarted && new NormalizedName(x.blueprint.name).equals(key),
    ),
  );
}

/**
 * The existing lift a rename would combine with, if the new name is another
 * lift's. Histories and notes merge then, which cannot be undone, so the
 * dialog says so before saving.
 */
export function mergesInto(
  newName: string,
  from: string,
  knownNames: readonly string[],
): string | undefined {
  const to = new NormalizedName(newName);
  if (to.equals(new NormalizedName(from))) {
    return undefined;
  }
  return knownNames.find((x) => new NormalizedName(x).equals(to));
}
