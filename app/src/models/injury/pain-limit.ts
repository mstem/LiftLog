import { Session } from '@/models/session-models';
import { RecordedWeightedExercise } from '@/models/session-models';

/**
 * Re-checks every lift's pain stop against a new limit, so raising the limit
 * reopens a stopped lift and lowering it stops one. With no limit (the injury
 * is resolved or gone) every pain stop is cleared. Returns the same session
 * when nothing changes.
 */
export function withPainLimit(
  session: Session,
  painLimit: number | undefined,
): Session {
  let changed = false;
  const recordedExercises = session.recordedExercises.map((x) => {
    if (!(x instanceof RecordedWeightedExercise)) {
      return x;
    }
    const next = x.withPainStop(painLimit ?? Number.POSITIVE_INFINITY);
    changed ||= next !== x;
    return next;
  });
  return changed ? session.with({ recordedExercises }) : session;
}
