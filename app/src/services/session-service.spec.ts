import { describe, it, expect } from 'vitest';
import BigNumber from 'bignumber.js';
import { SessionService } from '@/services/session-service';
import type { RootState } from '@/store';
import type { ProgressRepository } from '@/services/progress-repository';
import {
  IncreaseAllEvenlyProgressiveOverload,
  KeyedExerciseBlueprint,
  Rest,
  SessionBlueprint,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import {
  PotentialSet,
  RecordedSet,
  RecordedWeightedExercise,
} from '@/models/session-models';
import { Weight } from '@/models/weight';
import { tick } from '@/models/session-models/__test__/helpers';

const overload = () => new IncreaseAllEvenlyProgressiveOverload(BigNumber(2.5));

function blueprint(name: string, sets: number, reps: number) {
  return new WeightedExerciseBlueprint(
    name,
    sets,
    reps,
    overload(),
    Rest.medium,
    false,
    '',
    '',
  );
}

function keyed(bp: WeightedExerciseBlueprint) {
  return KeyedExerciseBlueprint.fromExerciseBlueprint(bp).toString();
}

function makeService() {
  const getState = (() =>
    ({ settings: { useImperialUnits: false } }) as unknown as RootState) as () => RootState;
  return new SessionService(null as unknown as ProgressRepository, getState);
}

function hydrateFirst(
  service: SessionService,
  bp: WeightedExerciseBlueprint,
  latest: Record<string, RecordedWeightedExercise | undefined>,
) {
  const session = service.hydrateSessionFromBlueprint(
    new SessionBlueprint('Test', [bp], ''),
    latest,
  );
  return session.recordedExercises[0] as RecordedWeightedExercise;
}

describe('SessionService weight carry-forward', () => {
  it('carries the last weight forward by movement when the rep scheme changed', () => {
    // History: Leg Press recorded at 3x12 @ 130kg
    const historyBp = blueprint('Leg Press', 3, 12);
    const w = new Weight(130, 'kilograms');
    const t = tick();
    const history = new RecordedWeightedExercise(
      historyBp,
      [
        new PotentialSet(new RecordedSet(12, t), w),
        new PotentialSet(new RecordedSet(12, tick()), w),
        new PotentialSet(new RecordedSet(12, tick()), w),
      ],
      undefined,
    );

    // New program uses a different scheme (4x10) -> strict key misses
    const newBp = blueprint('Leg Press', 4, 10);
    const result = hydrateFirst(makeService(), newBp, {
      [keyed(historyBp)]: history,
    });

    expect(result.potentialSets).toHaveLength(4);
    expect(result.potentialSets.every((s) => s.weight.equals(w))).toBe(true);
  });

  it('preserves per-set weights on an exact scheme match', () => {
    const bp = blueprint('Bench Press', 3, 10);
    const t = tick();
    // Last set below rep target -> not a progressive-overload success
    const history = new RecordedWeightedExercise(
      bp,
      [
        new PotentialSet(new RecordedSet(10, t), new Weight(60, 'kilograms')),
        new PotentialSet(
          new RecordedSet(10, tick()),
          new Weight(62.5, 'kilograms'),
        ),
        new PotentialSet(new RecordedSet(8, tick()), new Weight(65, 'kilograms')),
      ],
      undefined,
    );

    const result = hydrateFirst(makeService(), bp, { [keyed(bp)]: history });

    expect(result.potentialSets.map((s) => s.weight.value.toNumber())).toEqual([
      60, 62.5, 65,
    ]);
  });

  it('seeds zero weight when there is no history for the movement', () => {
    const result = hydrateFirst(makeService(), blueprint('Novel Lift', 3, 10), {});
    expect(result.potentialSets).toHaveLength(3);
    expect(result.potentialSets.every((s) => s.weight.value.isZero())).toBe(
      true,
    );
  });
});
