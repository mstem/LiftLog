/**
 * Groups injury mode gives the Pull-day lifts it pauses. The workout hides
 * them, and they count as done so the workout can finish without them. Kept
 * apart from rehab.ts, which imports the session models, so those models can
 * read it without a circular import.
 */
export const PAUSED_GROUP = 'injury-mode:paused';
export const PAUSED_BLANK_GROUP = 'injury-mode:paused-blank';

export function isPausedGroup(group: string | undefined): boolean {
  return group === PAUSED_GROUP || group === PAUSED_BLANK_GROUP;
}
