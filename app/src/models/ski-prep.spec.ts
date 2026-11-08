import { describe, expect, it } from 'vitest';
import { LocalDate } from '@js-joda/core';
import { SessionBlueprint } from '@/models/blueprint-models';
import {
  makeCardioBlueprint,
  makeWeightedBlueprint,
} from '@/models/session-models/__test__/helpers';
import { groupFromInput, REHAB_GROUP } from '@/models/injury/rehab';
import {
  defaultSkiPrepUntil,
  isLegDay,
  isSkiPrepActive,
  SKI_GROUP,
  skiDescriptors,
  skiExercises,
  withSkiBlock,
} from '@/models/ski-prep';

const legs = (exercises = [makeWeightedBlueprint('Hack Squat')]) =>
  new SessionBlueprint('Legs', [makeCardioBlueprint(), ...exercises], '');

describe('isLegDay', () => {
  it('is a workout with "leg" or "legs" as a word in its name', () => {
    expect(isLegDay('Legs')).toBe(true);
    expect(isLegDay('Leg day')).toBe(true);
    expect(isLegDay('Push')).toBe(false);
    expect(isLegDay('Pull (legless)')).toBe(false);
  });
});

describe('isSkiPrepActive', () => {
  const today = LocalDate.of(2026, 11, 8);

  it('is on until the end date, and off from that day', () => {
    expect(isSkiPrepActive('2027-01-03', today)).toBe(true);
    expect(isSkiPrepActive('2027-01-03', LocalDate.of(2027, 1, 2))).toBe(true);
    expect(isSkiPrepActive('2027-01-03', LocalDate.of(2027, 1, 3))).toBe(false);
  });

  it('is off with no end date', () => {
    expect(isSkiPrepActive(undefined, today)).toBe(false);
  });

  it('is off, not an error, when the stored date is malformed', () => {
    expect(isSkiPrepActive('2027-1-3', today)).toBe(false);
    expect(isSkiPrepActive('garbage', today)).toBe(false);
  });
});

describe('withSkiBlock', () => {
  it('puts the six ski lifts right after Warm Up on a Legs day', () => {
    const out = withSkiBlock(legs());
    expect(out.exercises.map((x) => x.name)).toEqual([
      makeCardioBlueprint().name,
      ...skiExercises.map((x) => x.name),
      'Hack Squat',
    ]);
    expect(out.exercises.slice(1, 7).every((x) => x.group === SKI_GROUP)).toBe(
      true,
    );
  });

  it('goes after an injury Rehab block', () => {
    const rehab = makeWeightedBlueprint('Supine punch').with({
      group: REHAB_GROUP,
    });
    const out = withSkiBlock(legs([rehab, makeWeightedBlueprint('Squat')]));
    expect(out.exercises[1]!.name).toBe('Supine punch');
    expect(out.exercises[2]!.group).toBe(SKI_GROUP);
  });

  it('leaves other days and a day that already has it alone', () => {
    const push = new SessionBlueprint('Push', [makeWeightedBlueprint()], '');
    expect(withSkiBlock(push)).toBe(push);
    const once = withSkiBlock(legs());
    expect(withSkiBlock(once)).toBe(once);
  });

  it('does not repeat a lift the plan already has', () => {
    const out = withSkiBlock(legs([makeWeightedBlueprint('Goblet Squat')]));
    expect(out.exercises.filter((x) => x.name === 'Goblet Squat')).toHaveLength(
      1,
    );
  });
});

describe('skiDescriptors', () => {
  it('adds only the lifts the library lacks', () => {
    expect(skiDescriptors().map((x) => x.name)).toEqual([
      'Wall Sit',
      'Lateral Lunge',
    ]);
  });
});

describe('defaultSkiPrepUntil', () => {
  it('is the coming 3 January', () => {
    expect(defaultSkiPrepUntil(LocalDate.of(2026, 11, 8))).toBe('2027-01-03');
    expect(defaultSkiPrepUntil(LocalDate.of(2027, 1, 2))).toBe('2027-01-03');
    expect(defaultSkiPrepUntil(LocalDate.of(2027, 1, 3))).toBe('2028-01-03');
  });
});

describe('the group box on a ski lift', () => {
  it('keeps the reserved ski id when the shown label is left as it is', () => {
    expect(groupFromInput('Ski prep', true, 'Ski prep', SKI_GROUP)).toBe(
      SKI_GROUP,
    );
  });

  it('becomes an ordinary group once the text changes', () => {
    expect(groupFromInput('Ski', true, 'Ski prep', SKI_GROUP)).toBe('Ski');
  });
});
