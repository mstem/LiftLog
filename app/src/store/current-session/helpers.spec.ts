import { describe, expect, it } from 'vitest';
import { Duration, Instant, OffsetDateTime } from '@js-joda/core';
import {
  NoProgressiveOverload,
  Rest,
  SessionBlueprint,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import { Session } from '@/models/session-models';
import {
  makeCardioBlueprint,
  makeSession,
} from '@/models/session-models/__test__/helpers';
import { getTimerInfo } from '@/store/current-session/helpers';

const NO_REST: Rest = {
  minRest: Duration.ZERO,
  maxRest: Duration.ZERO,
  failureRest: Duration.ZERO,
};

function exercise(name: string, rest: Rest) {
  return new WeightedExerciseBlueprint(
    name,
    3,
    10,
    new NoProgressiveOverload(),
    rest,
    false,
    '',
    '',
  );
}

/** A session with its first set recorded, so a rest is in progress. */
function restingSession(rest: Rest) {
  const time = OffsetDateTime.now();
  const blueprint = new SessionBlueprint(
    'Legs',
    [exercise('Squat', rest), exercise('Leg Press', rest)],
    '',
  );
  return Session.getEmptySession(blueprint, 'kilograms')
    .withCycledExerciseReps(0, 0, time)
    .with({ restTimerStartTime: time });
}

describe('getTimerInfo', () => {
  it('falls back to the default rest when the exercise configures none', () => {
    // Regression: reading restBetweenSets raw returned undefined here, so the
    // native worker never got a rest timer and cancelled its rest alarms - no
    // screen-off ding - even though the in-app timer (which applies the same
    // default) was counting down. The two must agree.
    const session = restingSession(NO_REST);

    const info = getTimerInfo(session);

    expect(info).toBeDefined();
    expect(session.restTimerEndTime).toBeDefined();
  });

  it('agrees with restTimerEndTime on when the rest is over', () => {
    const session = restingSession(NO_REST);

    const info = getTimerInfo(session);

    // restTimerEndTime uses minRest, which is what partiallyEndAt represents.
    expect(Instant.parse(info!.partiallyEndAt).epochSecond()).toBe(
      session.restTimerEndTime?.toEpochSecond(),
    );
  });

  it('still times the rest when only the min rest is zero', () => {
    // A zero min rest means "no minimum", not "no timer". Rest.orDefault only
    // substitutes the default when all three durations are zero, so a partially
    // configured rest fell straight through to the partialRest === ZERO guard and
    // the exercise got no timer at all - in the app or in the native worker -
    // silently throwing away the max rest the user had set.
    const session = restingSession({
      minRest: Duration.ZERO,
      maxRest: Duration.ofSeconds(90),
      failureRest: Duration.ofSeconds(180),
    });

    const info = getTimerInfo(session);

    expect(info).toBeDefined();
    expect(session.restTimerEndTime).toBeDefined();
  });

  it('times the rest after the last set even when the next exercise is cardio', () => {
    // Finishing an exercise makes it complete, so nextExercise falls through to
    // "the incomplete exercise with the latest time" - and when nothing else has
    // been started that is simply the FIRST incomplete one, which for a plan that
    // opens with a Mobility block or a Warm Up is a cardio exercise sitting above
    // the exercise just finished. getTimerInfo then bailed out on the
    // `nextExercise instanceof RecordedWeightedExercise` guard and gave no rest at
    // all. The rest length comes from lastExercise, so what comes next is
    // irrelevant to whether there is a rest.
    const time = OffsetDateTime.now();
    const session = makeSession([
      makeCardioBlueprint(1),
      exercise('Band Pull Apart', Rest.medium),
      exercise('Cable Rear Delt Fly', Rest.medium),
    ])
      // Complete every set of the weighted exercise, so it is complete.
      .withCycledExerciseReps(1, 0, time)
      .withCycledExerciseReps(1, 1, time)
      .withCycledExerciseReps(1, 2, time)
      .with({ restTimerStartTime: time });

    const info = getTimerInfo(session);

    expect(info).toBeDefined();
    expect(session.restTimerEndTime).toBeDefined();
  });

  it('uses the configured rest when one is set', () => {
    const session = restingSession(Rest.medium);

    const info = getTimerInfo(session);

    expect(info).toBeDefined();
    expect(
      Instant.parse(info!.partiallyEndAt).epochSecond() -
        Instant.parse(info!.startedAt).epochSecond(),
    ).toBe(Rest.medium.minRest.seconds());
  });
});
