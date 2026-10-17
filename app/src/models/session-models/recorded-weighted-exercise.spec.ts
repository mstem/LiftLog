import { describe, it, expect, beforeEach } from 'vitest';
import { Weight } from '@/models/weight';
import BigNumber from 'bignumber.js';
import { OffsetDateTime } from '@js-joda/core';
import {
  IncreaseAllEvenlyProgressiveOverload,
  Rest,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import {
  PotentialSet,
  RecordedSet,
  RecordedWeightedExercise,
} from '@/models/session-models/recorded-weighted-exercise';
import {
  filledPotentialSet,
  makeWeightedBlueprint,
  tick,
} from '@/models/session-models/__test__/helpers';

describe('RecordedWeightedExercise.withWeight', () => {
  let exercise: RecordedWeightedExercise;
  const light = new Weight(60, 'kilograms');
  const heavy = new Weight(120, 'kilograms');

  beforeEach(() => {
    const t = tick();
    exercise = new RecordedWeightedExercise(
      makeWeightedBlueprint(),
      [
        filledPotentialSet(10, t), // set 0 – completed
        new PotentialSet(undefined, light), // set 1 – uncompleted
        new PotentialSet(undefined, light), // set 2 – uncompleted
      ],
      undefined,
    );
  });

  it('thisSet only changes the targeted set', () => {
    const result = exercise.withWeight(1, heavy, 'thisSet');
    expect(result.potentialSets[0]!.weight).toEqual(
      exercise.potentialSets[0]!.weight,
    );
    expect(result.potentialSets[1]!.weight).toEqual(heavy);
    expect(result.potentialSets[2]!.weight).toEqual(light);
  });

  it('uncompletedSets leaves completed sets alone', () => {
    const originalCompletedWeight = exercise.potentialSets[0]!.weight;
    const result = exercise.withWeight(1, heavy, 'uncompletedSets');
    expect(result.potentialSets[0]!.weight).toEqual(originalCompletedWeight);
    expect(result.potentialSets[1]!.weight).toEqual(heavy);
    expect(result.potentialSets[2]!.weight).toEqual(heavy);
  });

  it('allSets updates every set including completed ones', () => {
    const result = exercise.withWeight(0, heavy, 'allSets');
    expect(result.potentialSets.every((s) => s.weight.equals(heavy))).toBe(
      true,
    );
  });
});

// ─── withNothingCompleted ─────────────────────────────────────────────────────

describe('RecordedWeightedExercise.withNothingCompleted', () => {
  it('clears all recorded sets and notes', () => {
    const bp = makeWeightedBlueprint();
    const t = tick();
    const exercise = new RecordedWeightedExercise(
      bp,
      [filledPotentialSet(10, t), filledPotentialSet(10, t.plusSeconds(30))],
      'some note',
    );

    const result = exercise.withNothingCompleted();

    expect(result.potentialSets.every((s) => s.set === undefined)).toBe(true);
    expect(result.notes).toBeUndefined();
  });

  it('preserves weights after clearing', () => {
    const bp = makeWeightedBlueprint();
    const t = tick();
    const weight = new Weight(80, 'kilograms');
    const exercise = new RecordedWeightedExercise(
      bp,
      [new PotentialSet(new RecordedSet(10, t), weight)],
      undefined,
    );

    const result = exercise.withNothingCompleted();
    expect(result.potentialSets[0]!.weight).toEqual(weight);
  });
});

describe('RecordedWeightedExercise.withRest', () => {
  it('changes the rest and keeps the sets already done', () => {
    const t = tick();
    const exercise = new RecordedWeightedExercise(
      makeWeightedBlueprint(),
      [
        filledPotentialSet(10, t),
        new PotentialSet(undefined, new Weight(60, 'kilograms')),
      ],
      undefined,
    );

    const result = exercise.withRest(Rest.long);

    expect(result.blueprint.restBetweenSets).toEqual(Rest.long);
    expect(result.potentialSets).toEqual(exercise.potentialSets);
    expect(result.blueprint.name).toBe(exercise.blueprint.name);
  });
});

describe('pain on sets', () => {
  const now = tick();
  const kg = new Weight(20, 'kilograms');
  const done = (pain?: number) =>
    new PotentialSet(new RecordedSet(8, now, pain), kg);
  const open = () => new PotentialSet(undefined, kg);
  const exerciseOf = (sets: PotentialSet[]) =>
    new RecordedWeightedExercise(makeWeightedBlueprint(), sets, undefined);

  it('loads a set saved before pain existed', () => {
    const set = RecordedSet.fromJSON(new RecordedSet(8, now).toJSON());
    expect(set.pain).toBeUndefined();
    expect('pain' in new RecordedSet(8, now).toJSON()).toBe(false);
  });

  it('round-trips pain', () => {
    expect(RecordedSet.fromJSON(new RecordedSet(8, now, 4).toJSON()).pain).toBe(
      4,
    );
  });

  it('treats sets with different pain as different', () => {
    expect(new RecordedSet(8, now, 4).equals(new RecordedSet(8, now, 5))).toBe(
      false,
    );
    expect(new RecordedSet(8, now, 4).equals(new RecordedSet(8, now, 4))).toBe(
      true,
    );
  });

  it('with keeps pain unless told otherwise', () => {
    const set = new RecordedSet(8, now, 4);
    expect(set.with({ repsCompleted: 5 }).pain).toBe(4);
    expect(set.with({ pain: undefined }).pain).toBeUndefined();
  });

  it('withSetPain sets pain on a completed set only', () => {
    const ex = exerciseOf([done(), open(), open()]);
    expect(ex.withSetPain(0, 6).potentialSets[0]!.set!.pain).toBe(6);
    expect(ex.withSetPain(1, 6)).toBe(ex);
  });

  it('finds the set that went over the limit', () => {
    const ex = exerciseOf([done(3), done(6), open()]);
    expect(ex.stoppedForPainAt(5)).toBe(1);
    expect(ex.stoppedForPainAt(6)).toBeUndefined();
  });
});

describe('pain through rep edits', () => {
  it('keeps pain when the reps of a completed set change', () => {
    const t0 = tick();
    const ex = new RecordedWeightedExercise(
      makeWeightedBlueprint(),
      [
        new PotentialSet(
          new RecordedSet(8, t0, 5),
          new Weight(20, 'kilograms'),
        ),
      ],
      undefined,
    );
    const edited = ex.withRepCount(0, 6, t0.plusSeconds(30));
    expect(edited.potentialSets[0]!.set!.repsCompleted).toBe(6);
    expect(edited.potentialSets[0]!.set!.pain).toBe(5);
  });
});

describe('stopped for pain', () => {
  const now = tick();
  const kg = new Weight(20, 'kilograms');
  const done = (pain?: number) =>
    new PotentialSet(new RecordedSet(8, now, pain), kg);
  const open = () => new PotentialSet(undefined, kg);
  const exerciseOf = (sets: PotentialSet[]) =>
    new RecordedWeightedExercise(makeWeightedBlueprint(), sets, undefined);

  it('counts as complete with open sets once stopped', () => {
    const ex = exerciseOf([done(7), open(), open()]);
    expect(ex.isComplete).toBe(false);
    expect(ex.withPainStop(5).isComplete).toBe(true);
    expect(ex.withPainStop(5).stoppedForPain).toBe(true);
  });

  it('clears the stop when no set is over the limit', () => {
    const stopped = exerciseOf([done(7), open(), open()]).withPainStop(5);
    const lowered = stopped.withSetPain(0, 4).withPainStop(5);
    expect(lowered.stoppedForPain).toBeUndefined();
    expect(lowered.isComplete).toBe(false);
    const unticked = stopped.withRepCount(0, undefined, tick()).withPainStop(5);
    expect(unticked.stoppedForPain).toBeUndefined();
  });

  it('keeps the flag through with, withSetPain and a JSON round-trip', () => {
    const stopped = exerciseOf([done(7), open()]).withPainStop(5);
    expect(stopped.withSetPain(0, 8).stoppedForPain).toBe(true);
    expect(stopped.with({ notes: 'x' }).stoppedForPain).toBe(true);
    expect(
      RecordedWeightedExercise.fromJSON(stopped.toJSON()).stoppedForPain,
    ).toBe(true);
  });

  it('leaves the flag out of JSON when not stopped', () => {
    expect('stoppedForPain' in exerciseOf([done()]).toJSON()).toBe(false);
  });

  it('is part of equality', () => {
    const ex = exerciseOf([done(7), open()]);
    expect(ex.equals(ex.withPainStop(5))).toBe(false);
    expect(ex.withPainStop(5).equals(ex.withPainStop(5))).toBe(true);
  });

  it('withNothingCompleted clears it', () => {
    const stopped = exerciseOf([done(7), open()]).withPainStop(5);
    expect(stopped.withNothingCompleted().stoppedForPain).toBeUndefined();
  });
});

describe('isSetLockedForPain', () => {
  const blueprint = new WeightedExerciseBlueprint(
    'Standing Military Press',
    3,
    8,
    new IncreaseAllEvenlyProgressiveOverload(BigNumber(2.5)),
    Rest.medium,
    false,
    '',
    '',
  );
  const kg20 = new Weight(20, 'kilograms');
  // Sets 1 and 2 ticked, then set 1 rated 8 after the fact; set 3 not done.
  const exercise = new RecordedWeightedExercise(
    blueprint,
    [
      new PotentialSet(new RecordedSet(8, OffsetDateTime.now(), 8), kg20),
      new PotentialSet(new RecordedSet(8, OffsetDateTime.now()), kg20),
      new PotentialSet(undefined, kg20),
    ],
    undefined,
  );

  it('keeps a set ticked after the stop editable', () => {
    expect(exercise.isSetLockedForPain(1, 5)).toBe(false);
  });

  it('locks an undone set after the stop', () => {
    expect(exercise.isSetLockedForPain(2, 5)).toBe(true);
  });

  it('locks nothing under the limit', () => {
    expect(exercise.isSetLockedForPain(2, 8)).toBe(false);
  });
});
