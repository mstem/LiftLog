import { describe, expect, it } from 'vitest';
import {
  CardioExerciseBlueprint,
  ExerciseBlueprint,
  SessionBlueprint,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import { Session } from '@/models/session-models';
import {
  makeCardioSetBlueprint,
  makeWeightedBlueprint,
  tick,
} from '@/models/session-models/__test__/helpers';
import {
  ROLLED_OVER_GROUP,
  rolledOverExercises,
  withoutRolledOverExercises,
  withRolledOverExercises,
} from '@/models/roll-over';

const lift = (name: string, group?: string) =>
  makeWeightedBlueprint(name).with({ group });
const cardio = (name: string, group?: string) =>
  new CardioExerciseBlueprint(name, [makeCardioSetBlueprint()], '', '', group);
const names = (exercises: readonly ExerciseBlueprint[]) =>
  exercises.map((x) => `${x.name}${x.group ? ` [${x.group}]` : ''}`);

// Legs as Matt runs it: a Mobility block, the Warm Up, then the lifts.
const legs = new SessionBlueprint(
  'Legs',
  [
    cardio('Cycling', 'Mobility'),
    lift('Kickover', 'Mobility'),
    cardio('Warm Up'),
    lift('Hack Squat'),
    lift('Leg Press'),
    lift('Ab Roller', ROLLED_OVER_GROUP),
  ],
  '',
);
const push = new SessionBlueprint(
  'Push',
  [
    cardio('Cycling', 'Mobility'),
    lift('Kickover', 'Mobility'),
    cardio('Warm Up'),
    lift('Bench Press'),
  ],
  '',
);

function finished(blueprint: SessionBlueprint, doneExercises: string[]) {
  let session = Session.getEmptySession(blueprint, 'kilograms');
  blueprint.exercises.forEach((ex, i) => {
    if (
      doneExercises.includes(ex.name) &&
      ex instanceof WeightedExerciseBlueprint
    ) {
      session = session.withCycledExerciseReps(i, 0, tick());
    }
  });
  return session;
}

describe('rolledOverExercises', () => {
  it('takes only untouched lifts outside any group', () => {
    const rolled = rolledOverExercises(finished(legs, ['Leg Press']));

    // Leg Press was done, Kickover is Mobility, Cycling and Warm Up are cardio,
    // Ab Roller already rolled over once.
    expect(rolled.map((x) => x.name)).toEqual(['Hack Squat']);
  });

  it('skips a lift with even one set ticked', () => {
    expect(
      rolledOverExercises(finished(legs, ['Hack Squat', 'Leg Press'])),
    ).toEqual([]);
  });
});

describe('withRolledOverExercises', () => {
  it('puts them after the opening Mobility and Warm Up, in their own group', () => {
    const next = withRolledOverExercises(push, [lift('Hack Squat')]);

    expect(names(next.exercises)).toEqual([
      'Cycling [Mobility]',
      'Kickover [Mobility]',
      'Warm Up',
      `Hack Squat [${ROLLED_OVER_GROUP}]`,
      'Bench Press',
    ]);
  });

  it('goes to the top when the workout has no warm-up block', () => {
    const bare = new SessionBlueprint('Arms', [lift('Curl')], '');

    expect(
      names(withRolledOverExercises(bare, [lift('Shrug')]).exercises),
    ).toEqual([`Shrug [${ROLLED_OVER_GROUP}]`, 'Curl']);
  });

  it('does not add a lift the next workout already has', () => {
    const next = withRolledOverExercises(push, [
      lift('bench press '),
      lift('Hack Squat'),
    ]);

    expect(next.exercises.map((x) => x.name)).toEqual([
      'Cycling',
      'Kickover',
      'Warm Up',
      'Hack Squat',
      'Bench Press',
    ]);
  });

  it('drops a superset link, which would otherwise chain into the next lift', () => {
    const linked = lift('Hack Squat').with({ supersetWithNext: true });
    const rolled = withRolledOverExercises(push, [linked]).exercises[3];

    expect(rolled).toMatchObject({ supersetWithNext: false });
  });

  it('leaves the workout untouched when nothing rolls over', () => {
    expect(withRolledOverExercises(push, [])).toBe(push);
  });
});

describe('withoutRolledOverExercises', () => {
  it('gives back the planned workout', () => {
    const next = withRolledOverExercises(push, [lift('Hack Squat')]);

    expect(withoutRolledOverExercises(next).equals(push)).toBe(true);
  });
});
