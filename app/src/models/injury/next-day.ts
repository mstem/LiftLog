import { Duration, LocalDate, OffsetDateTime } from '@js-joda/core';
import { RecordedWeightedExercise, Session } from '@/models/session-models';
import {
  Injury,
  injuryEraStart,
  NextDayAnswer,
} from '@/models/injury/injury';
import { isShoulderLoaded } from '@/models/injury/flags';
import { REHAB_GROUP } from '@/models/injury/rehab';

const minimumHours = 12;

/**
 * The most recent session since onset with a ticked pain-tracked lift, when it
 * was done after injury mode was turned on (see injuryEraStart), when it
 * has no next-day answer yet and its last tracked set was 12 or more hours ago.
 * Older sessions are never asked about.
 */
export function pendingNextDayCheck(args: {
  sessions: Session[];
  injury: Injury | undefined;
  answers: Record<string, NextDayAnswer>;
  overrides: Record<string, boolean>;
  now: OffsetDateTime;
}): Session | undefined {
  const { injury } = args;
  if (!injury) {
    return undefined;
  }
  const onset = LocalDate.parse(injury.onsetDate);
  const eraStart = injuryEraStart(injury);
  const latest = args.sessions
    .filter((s) => !s.date.isBefore(onset))
    .map((s) => ({ s, last: lastTrackedSetTime(s, args.overrides) }))
    .filter((x): x is { s: Session; last: OffsetDateTime } => !!x.last)
    .filter((x) => !x.last.isBefore(eraStart))
    .sort((a, b) => b.last.compareTo(a.last))[0];
  if (
    !latest ||
    args.answers[latest.s.id] ||
    Duration.between(latest.last, args.now).toHours() < minimumHours
  ) {
    return undefined;
  }
  return latest.s;
}

function lastTrackedSetTime(
  session: Session,
  overrides: Record<string, boolean>,
): OffsetDateTime | undefined {
  return session.recordedExercises
    .filter(
      (x): x is RecordedWeightedExercise =>
        x instanceof RecordedWeightedExercise &&
        (x.blueprint.group === REHAB_GROUP ||
          isShoulderLoaded(x.blueprint.name, overrides)),
    )
    .flatMap((x) => x.potentialSets.map((p) => p.set?.completionDateTime))
    .filter((t): t is OffsetDateTime => !!t)
    .sort((a, b) => a.compareTo(b))
    .pop();
}
