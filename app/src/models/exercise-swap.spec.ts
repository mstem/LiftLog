import { describe, expect, it } from 'vitest';
import { OffsetDateTime } from '@js-joda/core';
import {
  NoProgressiveOverload,
  Rest,
  SessionBlueprint,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import { RecordedWeightedExercise, Session } from '@/models/session-models';
import { Weight } from '@/models/weight';
import { swapExercise, undoSwaps } from '@/models/exercise-swap';

const lift = (name: string, superset = false) =>
  new WeightedExerciseBlueprint(
    name,
    3,
    10,
    new NoProgressiveOverload(),
    Rest.long,
    superset,
    'planned notes',
    'https://example.com/hack-squat',
    'Legs block',
  );

const planned = new SessionBlueprint(
  'Legs',
  [lift('Hack Squat', true), lift('Leg Press')],
  '',
);
const fresh = Session.getEmptySession(planned, 'kilograms');
const weights = (session: Session, index = 0) =>
  (
    session.recordedExercises[index] as RecordedWeightedExercise
  ).potentialSets.map((s) => s.weight.value.toNumber());

describe('swapExercise', () => {
  it('keeps the plan for the slot and swaps in the new lift', () => {
    const swapped = swapExercise(fresh, 0, 'Chair Squat', undefined);
    const bp = swapped.recordedExercises[0]!
      .blueprint as WeightedExerciseBlueprint;

    expect(bp.name).toBe('Chair Squat');
    expect(bp.sets).toBe(3);
    expect(bp.repsPerSet).toBe(10);
    expect(bp.restBetweenSets).toEqual(Rest.long);
    expect(bp.supersetWithNext).toBe(true);
    expect(bp.group).toBe('Legs block');
    // Notes and the link belonged to the planned lift
    expect(bp.notes).toBe('');
    expect(bp.link).toBe('');
    expect(swapped.blueprint.exercises[0]!.name).toBe('Chair Squat');
  });

  it("uses the swapped-in lift's last weight on every set", () => {
    const swapped = swapExercise(
      fresh,
      0,
      'Chair Squat',
      new Weight(80, 'kilograms'),
    );

    expect(weights(swapped)).toEqual([80, 80, 80]);
  });

  it('keeps the planned weight when the lift has no history', () => {
    const weighted = fresh.withExercise(
      0,
      (fresh.recordedExercises[0] as RecordedWeightedExercise).withAllSets(
        (s) => s.with({ weight: new Weight(60, 'kilograms') }),
      ),
    );
    const swapped = swapExercise(weighted, 0, 'Chair Squat', undefined);

    expect(weights(swapped)).toEqual([60, 60, 60]);
  });

  it('refuses once a set of the exercise is ticked', () => {
    const started = fresh.withCycledExerciseReps(0, 0, OffsetDateTime.now());

    expect(() => swapExercise(started, 0, 'Chair Squat', undefined)).toThrow();
  });
});

describe('undoSwaps', () => {
  it('puts the planned lift back in its slot for comparing with the plan', () => {
    const swapped = swapExercise(fresh, 0, 'Chair Squat', undefined);
    const original = planned.exercises[0] as WeightedExerciseBlueprint;

    const restored = undoSwaps(swapped.blueprint, [
      { swappedIn: 'Chair Squat', original },
    ]);

    expect(restored.equals(planned)).toBe(true);
  });

  it('finds the swapped lift by name even after the workout changed around it', () => {
    const swapped = swapExercise(
      fresh,
      1,
      'Smith Machine Leg Press',
      undefined,
    );
    const reordered = swapped.blueprint.with({
      exercises: [...swapped.blueprint.exercises].reverse(),
    });

    const restored = undoSwaps(reordered, [
      {
        swappedIn: 'Smith Machine Leg Press',
        original: planned.exercises[1] as WeightedExerciseBlueprint,
      },
    ]);

    expect(restored.exercises.map((x) => x.name)).toEqual([
      'Leg Press',
      'Hack Squat',
    ]);
  });
});
