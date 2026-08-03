import { describe, expect, it } from 'vitest';
import { Duration, Instant, OffsetDateTime } from '@js-joda/core';
import {
  NoProgressiveOverload,
  Rest,
  SessionBlueprint,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import { Session } from '@/models/session-models';
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
