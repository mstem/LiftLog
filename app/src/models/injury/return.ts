import { LocalDate, OffsetDateTime } from '@js-joda/core';
import { RecordedWeightedExercise, Session } from '@/models/session-models';
import { Injury, injuryEraStart, NextDayAnswer } from '@/models/injury/injury';
import { isShoulderLoaded } from '@/models/injury/flags';
import { REHAB_GROUP } from '@/models/injury/rehab';

/**
 * Graded return of the pull-day lifts the rehab block replaces. A paused lift
 * comes back once two gym sessions in a row were quiet: no set scored above
 * the threshold and the next morning was "not worse". One lift returns per
 * pull day, rows first and overhead work last. A session that stops a lift
 * for pain, or is followed by a "worse" morning, sends the most recent
 * returnee back on pause and the count starts again.
 */
export const returnPainThreshold = 3;
export const quietSessionsNeeded = 2;

/** Hand override of the rule for one lift, by normalized name. */
export type ReturnOverride = 'returned' | 'paused';

export function isPullDay(sessionName: string): boolean {
  return /\bpull\b/i.test(sessionName);
}

/**
 * Where a lift sits in the order of return. Lower comes back first: cable
 * and machine rows, then other rows, barbell rows, pull-aparts and rear
 * delt work, pulldowns, and last anything overhead or hanging.
 */
export function returnRank(name: string): number {
  const lower = name.toLowerCase();
  if (/upright/.test(lower)) return 6;
  if (/\brows?\b/.test(lower)) {
    if (/cable|machine|seated/.test(lower)) return 0;
    if (/barbell/.test(lower)) return 2;
    return 1;
  }
  if (/pull ?-?apart|rear delt|reverse fly|face pull/.test(lower)) return 3;
  if (/pull ?-?down/.test(lower)) return 4;
  if (/(pull|chin) ?-?ups?\b|\bhang(ing)?\b|pullover|overhead/.test(lower))
    return 5;
  return 7;
}

function trackedLifts(
  session: Session,
  overrides: Record<string, boolean>,
): RecordedWeightedExercise[] {
  return session.recordedExercises.filter(
    (x): x is RecordedWeightedExercise =>
      x instanceof RecordedWeightedExercise &&
      (x.blueprint.group === REHAB_GROUP ||
        isShoulderLoaded(x.blueprint.name, overrides)) &&
      x.potentialSets.some((p) => p.set),
  );
}

/**
 * How many paused pull-day lifts are back, replayed from the injury-era
 * history: sessions on or after onset whose tracked sets were all ticked
 * after injury mode was turned on. The latest session with no next-day
 * answer yet holds the streak until it is answered; an older unanswered
 * one counts as quiet. The result includes the lift the next pull day earns
 * when the streak is already long enough.
 */
export function returnedLiftCount(args: {
  sessions: Session[];
  injury: Injury;
  overrides: Record<string, boolean>;
  answers: Record<string, NextDayAnswer>;
}): number {
  const { injury, overrides, answers } = args;
  const onset = LocalDate.parse(injury.onsetDate);
  const eraStart = injuryEraStart(injury);
  const era = args.sessions
    .filter((s) => !s.date.isBefore(onset))
    .map((s) => ({ s, lifts: trackedLifts(s, overrides) }))
    .filter((x) => x.lifts.length > 0)
    .filter((x) =>
      x.lifts.every((l) =>
        l.potentialSets.every(
          (p) => !p.set || !p.set.completionDateTime.isBefore(eraStart),
        ),
      ),
    )
    .sort(
      (a, b) =>
        a.s.date.compareTo(b.s.date) ||
        firstSetTime(a.lifts).compareTo(firstSetTime(b.lifts)),
    );

  let count = 0;
  let streak = 0;
  era.forEach(({ s, lifts }, i) => {
    if (isPullDay(s.blueprint.name) && streak >= quietSessionsNeeded) {
      count++;
    }
    const failed =
      answers[s.id] === 'worse' ||
      lifts.some((l) => l.stoppedForPainAt(injury.painLimit) !== undefined);
    if (failed) {
      count = Math.max(0, count - 1);
      streak = 0;
      return;
    }
    const lowPain = lifts.every((l) =>
      l.potentialSets.every(
        (p) => p.set?.pain === undefined || p.set.pain <= returnPainThreshold,
      ),
    );
    if (!lowPain) {
      streak = 0;
      return;
    }
    // The latest session waits on its next-day answer: it holds the streak
    // until then, neither adding to it nor breaking it
    const waiting = !answers[s.id] && i === era.length - 1;
    if (!waiting) {
      streak++;
    }
  });
  return count + (streak >= quietSessionsNeeded ? 1 : 0);
}

/** When the first ticked set of these lifts was done, to order same-day workouts. */
function firstSetTime(lifts: RecordedWeightedExercise[]): OffsetDateTime {
  return lifts
    .flatMap((l) => l.potentialSets.flatMap((p) => (p.set ? [p.set] : [])))
    .map((x) => x.completionDateTime)
    .reduce((min, x) => (x.isBefore(min) ? x : min));
}
