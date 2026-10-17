import { describe, it, expect } from 'vitest';
import BigNumber from 'bignumber.js';
import { OffsetDateTime } from '@js-joda/core';
import {
  IncreaseAllEvenlyProgressiveOverload,
  Rest,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import {
  EmptySession,
  PotentialSet,
  RecordedSet,
  RecordedWeightedExercise,
} from '@/models/session-models';
import { Weight } from '@/models/weight';
import { withPainLimit } from '@/models/injury/pain-limit';

const press = new WeightedExerciseBlueprint(
  'Standing Military Press',
  3,
  8,
  new IncreaseAllEvenlyProgressiveOverload(BigNumber(2.5)),
  Rest.medium,
  false,
  '',
  '',
);

// Set 1 rated 6, sets 2 and 3 not done yet, stopped under a limit of 5.
const stopped = new RecordedWeightedExercise(
  press,
  [
    new PotentialSet(
      new RecordedSet(8, OffsetDateTime.now(), 6),
      new Weight(20, 'kilograms'),
    ),
    new PotentialSet(undefined, new Weight(20, 'kilograms')),
    new PotentialSet(undefined, new Weight(20, 'kilograms')),
  ],
  undefined,
).withPainStop(5);
const session = EmptySession.with({ recordedExercises: [stopped] });

describe('withPainLimit', () => {
  it('reopens a stopped lift when the limit is raised above its pain', () => {
    const out = withPainLimit(session, 7);
    const lift = out.recordedExercises[0] as RecordedWeightedExercise;
    expect(lift.stoppedForPain).toBeUndefined();
    expect(lift.isComplete).toBe(false);
  });

  it('clears every pain stop when there is no limit', () => {
    const out = withPainLimit(session, undefined);
    const lift = out.recordedExercises[0] as RecordedWeightedExercise;
    expect(lift.stoppedForPain).toBeUndefined();
  });

  it('returns the same session when nothing changes', () => {
    expect(withPainLimit(session, 5)).toBe(session);
  });
});
