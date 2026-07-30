import { describe, it, expect } from 'vitest';
import { groupExercises } from '@/components/smart/group-exercises';
import { RecordedExercise } from '@/models/session-models';
import { RecordedWeightedExercise } from '@/models/session-models/recorded-weighted-exercise';
import { makeWeightedBlueprint } from '@/models/session-models/__test__/helpers';

function exercise(name: string, group?: string): RecordedExercise {
  return new RecordedWeightedExercise(
    makeWeightedBlueprint(name).with({ group }),
    [],
    undefined,
  );
}

describe('groupExercises', () => {
  it('returns a single ungrouped segment when nothing has a group', () => {
    const segments = groupExercises([exercise('Squat'), exercise('Leg Press')]);

    expect(segments).toHaveLength(1);
    expect(segments[0]!.group).toBeUndefined();
    expect(segments[0]!.entries.map((e) => e.index)).toEqual([0, 1]);
  });

  it('splits a leading group from the rest of the session', () => {
    const segments = groupExercises([
      exercise('Cycling', 'Mobility'),
      exercise('Pigeon', 'Mobility'),
      exercise('Squat'),
      exercise('Leg Press'),
    ]);

    expect(segments.map((s) => s.group)).toEqual(['Mobility', undefined]);
    expect(segments[0]!.entries.map((e) => e.index)).toEqual([0, 1]);
    expect(segments[1]!.entries.map((e) => e.index)).toEqual([2, 3]);
  });

  it('preserves original indices for a group in the middle', () => {
    const segments = groupExercises([
      exercise('Squat'),
      exercise('Pigeon', 'Mobility'),
      exercise('Leg Press'),
    ]);

    expect(segments.map((s) => s.group)).toEqual([
      undefined,
      'Mobility',
      undefined,
    ]);
    // The index is what edit callbacks write back through - it must stay
    // the position in the original session, not a per-segment offset.
    expect(segments[1]!.entries[0]!.index).toBe(1);
    expect(segments[2]!.entries[0]!.index).toBe(2);
  });

  it('keeps non-adjacent runs of the same group as separate segments', () => {
    const segments = groupExercises([
      exercise('Cycling', 'Mobility'),
      exercise('Squat'),
      exercise('Pigeon', 'Mobility'),
    ]);

    expect(segments.map((s) => s.group)).toEqual([
      'Mobility',
      undefined,
      'Mobility',
    ]);
    expect(segments.map((s) => s.key)).toHaveLength(new Set(segments.map((s) => s.key)).size);
  });

  it('treats an empty group string as ungrouped', () => {
    const segments = groupExercises([exercise('Squat', ''), exercise('Leg Press')]);

    expect(segments).toHaveLength(1);
    expect(segments[0]!.group).toBeUndefined();
  });

  it('returns nothing for an empty session', () => {
    expect(groupExercises([])).toEqual([]);
  });
});
