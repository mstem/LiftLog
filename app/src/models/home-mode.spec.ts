import { describe, expect, it } from 'vitest';
import library from '../../assets/exercises.json';
import {
  SessionBlueprint,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import {
  canSwitchHome,
  fromHomeWorkout,
  HOME_GROUP,
  homeDescriptors,
  homeLiftFor,
  homeLiftNames,
  homeLoad,
  homeReps,
  toHomeWorkout,
  undoHomeLifts,
} from '@/models/home-mode';
import { PAUSED_GROUP } from '@/models/injury/paused-group';
import {
  ROLLED_OVER_GROUP,
  withoutRolledOverExercises,
} from '@/models/roll-over';
import { RecordedWeightedExercise, Session } from '@/models/session-models';
import {
  makeWeightedBlueprint,
  tick,
} from '@/models/session-models/__test__/helpers';
import { Weight } from '@/models/weight';

function lift(name: string, sets: number, reps: number, group?: string) {
  const bp = makeWeightedBlueprint(name);
  return new WeightedExerciseBlueprint(
    name,
    sets,
    reps,
    bp.progressiveOverload,
    bp.restBetweenSets,
    false,
    'gym note',
    'https://example.com',
    group,
  );
}

/** A workout with each lift at its last gym weight. */
function workout(name: string, lifts: [WeightedExerciseBlueprint, number][]) {
  const session = Session.getEmptySession(
    new SessionBlueprint(
      name,
      lifts.map(([x]) => x),
      '',
    ),
    'kilograms',
  );
  return lifts.reduce((s, [, kg], i) => {
    const ex = s.recordedExercises[i] as RecordedWeightedExercise;
    return s.withExercise(
      i,
      ex.withAllSets((x) => x.with({ weight: new Weight(kg, 'kilograms') })),
    );
  }, session);
}

const at = (s: Session, i: number) =>
  s.recordedExercises[i] as RecordedWeightedExercise;

describe('homeLoad', () => {
  it('takes the heaviest load not over the gym weight', () => {
    expect(homeLoad([7.5, 5], 40)).toBe(7.5);
    expect(homeLoad([7.5, 5], 6)).toBe(5);
  });

  it('takes the lightest when every load is over the gym weight', () => {
    expect(homeLoad([7.5, 5], 2)).toBe(5);
  });

  it('is 0 for bodyweight and band lifts', () => {
    expect(homeLoad([], 30)).toBe(0);
  });
});

describe('homeReps', () => {
  it('scales reps by how much lighter home is, up to 20', () => {
    expect(homeReps(8, 12, 9)).toBe(11);
    expect(homeReps(12, 40, 7.5)).toBe(20);
  });

  it('keeps the planned reps at the same weight or with no load', () => {
    expect(homeReps(12, 5, 5)).toBe(12);
    expect(homeReps(12, 30, 0)).toBe(12);
  });
});

describe('toHomeWorkout', () => {
  const push = () =>
    workout('Push', [
      [lift('Cat Cow', 1, 10, 'Mobility'), 0],
      [lift('Incline Bench Press (Barbell)', 4, 12), 40],
      [lift('Cable Fly Crossovers', 4, 12), 5],
      [lift('Push Up', 3, 15), 0],
    ]);

  it('swaps a gym lift for its home version at the home load', () => {
    const { session } = toHomeWorkout(push());
    const press = at(session, 1);
    expect(press.blueprint.name).toBe('Incline Dumbbell Press');
    expect(press.blueprint.repsPerSet).toBe(20);
    expect(press.potentialSets.every((x) => x.weight.value.eq(7.5))).toBe(true);
    expect(press.blueprint.notes).toContain('Lower over 3 s');
    expect(press.blueprint.link).toBe('');
  });

  it('keeps the reps when the home load matches the gym', () => {
    const fly = at(toHomeWorkout(push()).session, 2);
    expect(fly.blueprint.name).toBe('Dumbbell Fly');
    expect(fly.blueprint.repsPerSet).toBe(12);
    expect(fly.blueprint.notes).not.toContain('Lower over 3 s');
  });

  it('leaves blocks and lifts with nothing to change alone', () => {
    const { session } = toHomeWorkout(push());
    expect(at(session, 0).blueprint.name).toBe('Cat Cow');
    expect(at(session, 3).blueprint.name).toBe('Push Up');
  });

  it('switches a rolled-over lift too, and leaves a rolled-over gym-only one', () => {
    const legs = workout('Legs', [
      [lift('Leg Press', 4, 10, ROLLED_OVER_GROUP), 127],
      [lift('Pullups', 4, 3, ROLLED_OVER_GROUP), 0],
    ]);
    const { session } = toHomeWorkout(legs);
    expect(at(session, 0).blueprint.name).toBe('Dumbbell Step-up');
    expect(at(session, 0).blueprint.group).toBe(ROLLED_OVER_GROUP);
    expect(at(session, 1).blueprint.group).toBe(ROLLED_OVER_GROUP);
  });

  it('pauses a lift that needs the gym', () => {
    const pull = workout('Pull', [[lift('Pullups', 4, 3), 0]]);
    const { session } = toHomeWorkout(pull);
    expect(at(session, 0).blueprint.group).toBe(PAUSED_GROUP);
    expect(at(session, 0).isComplete).toBe(true);
  });

  it('adds the ring squeeze to Legs day only', () => {
    const legs = workout('Legs', [[lift('Hack Squat', 6, 8), 60]]);
    const home = toHomeWorkout(legs).session;
    expect(home.recordedExercises.at(-1)!.blueprint.group).toBe(HOME_GROUP);
    expect(toHomeWorkout(push()).session.recordedExercises).toHaveLength(4);
  });

  it('adds a rep once every set hit the target last time at home', () => {
    const last = at(toHomeWorkout(push()).session, 2);
    const done = last.potentialSets.reduce(
      (ex, _, i) => ex.withRepCount(i, 12, tick()),
      last,
    );
    const fly = at(
      toHomeWorkout(push(), (bp) =>
        bp.name === 'Dumbbell Fly' ? done : undefined,
      ).session,
      2,
    );
    expect(fly.blueprint.repsPerSet).toBe(13);
  });

  it('leaves a lift with a ticked set alone', () => {
    const started = push().withExercise(
      1,
      at(push(), 1).withRepCount(0, 12, tick()),
    );
    const { session } = toHomeWorkout(started);
    expect(at(session, 1).blueprint.name).toBe('Incline Bench Press (Barbell)');
  });

  it('never offers home lifts to the plan', () => {
    const legs = workout('Legs', [[lift('Hack Squat', 6, 8), 60]]);
    const home = toHomeWorkout(legs).session;
    expect(
      withoutRolledOverExercises(home.blueprint).exercises.map((x) => x.name),
    ).toEqual(['Goblet Squat']);
  });
});

describe('the ring squeeze', () => {
  it('stays out when home mode only paused gym lifts', () => {
    const legs = workout('Legs', [[lift('TRX Squat', 3, 12), 0]]);
    expect(toHomeWorkout(legs).session.recordedExercises).toHaveLength(1);
  });
});

describe('switching home mode on again', () => {
  it('never adds a second ring squeeze', () => {
    const legs = workout('Legs', [[lift('Hack Squat', 6, 8), 60]]);
    const { session, changes } = toHomeWorkout(legs);
    const ring = session.recordedExercises.length - 1;
    const started = session.withExercise(
      ring,
      at(session, ring).withRepCount(0, 15, tick()),
    );
    const again = toHomeWorkout(fromHomeWorkout(started, changes)).session;
    expect(
      again.recordedExercises.filter(
        (x) => x.blueprint.name === 'Pilates Ring Adductor Squeeze',
      ),
    ).toHaveLength(1);
  });
});

describe('undoHomeLifts', () => {
  it('turns home lifts back into the planned gym lifts from the plan alone', () => {
    const legs = workout('Legs', [
      [lift('Hack Squat', 6, 8), 60],
      [lift('Leg Press', 4, 10), 127],
    ]);
    const home = toHomeWorkout(legs).session;
    expect(
      undoHomeLifts(home.blueprint, legs.blueprint).exercises.map(
        (x) => x.name,
      ),
    ).toEqual(['Hack Squat', 'Leg Press', 'Pilates Ring Adductor Squeeze']);
  });

  it('leaves a home lift that is also planned as it is', () => {
    const plan = workout('Legs', [[lift('Goblet Squat', 3, 8), 12]]);
    expect(
      undoHomeLifts(plan.blueprint, plan.blueprint).exercises.map(
        (x) => x.name,
      ),
    ).toEqual(['Goblet Squat']);
  });
});

describe('fromHomeWorkout', () => {
  it('restores the lift it replaced, not a planned one of the same name', () => {
    const push = workout('Push', [
      [lift('Incline Dumbbell Press', 3, 10), 10],
      [lift('Incline Bench Press (Barbell)', 4, 12), 40],
    ]);
    const { session, changes } = toHomeWorkout(push);
    const back = fromHomeWorkout(session, changes);
    expect(back.recordedExercises.map((x) => x.blueprint.name)).toEqual([
      'Incline Dumbbell Press',
      'Incline Bench Press (Barbell)',
    ]);
  });

  it('puts the gym workout back as it was', () => {
    const legs = workout('Legs', [
      [lift('Hack Squat', 6, 8), 60],
      [lift('TRX Squat', 3, 12), 0],
    ]);
    const { session, changes } = toHomeWorkout(legs);
    const back = fromHomeWorkout(session, changes);
    expect(back.blueprint.equals(legs.blueprint)).toBe(true);
    expect(at(back, 0).potentialSets[0]!.weight.value.eq(60)).toBe(true);
  });
});

describe('canSwitchHome', () => {
  it('is on until a planned lift has a set ticked', () => {
    const legs = workout('Legs', [
      [lift('Cat Cow', 1, 10, 'Mobility'), 0],
      [lift('Hack Squat', 6, 8), 60],
    ]);
    const mobilityDone = legs.withExercise(
      0,
      at(legs, 0).withRepCount(0, 10, tick()),
    );
    expect(canSwitchHome(mobilityDone)).toBe(true);
    expect(
      canSwitchHome(
        legs.withExercise(1, at(legs, 1).withRepCount(0, 8, tick())),
      ),
    ).toBe(false);
  });
});

describe('homeLiftFor', () => {
  it('finds a lift whatever its case', () => {
    expect(homeLiftFor('hack squat')).toEqual(
      expect.objectContaining({ name: 'Goblet Squat' }),
    );
    expect(homeLiftFor('Pullups')).toBe('gym only');
    expect(homeLiftFor('Push Up')).toBeUndefined();
  });
});

describe('home lifts in the library', () => {
  it('gives every home lift muscles, so the body graph counts it', () => {
    const muscles = new Map(
      [
        ...library.exercises.map((x) => ({
          name: x.name,
          muscles: [...x.primaryMuscles, ...x.secondaryMuscles],
        })),
        ...homeDescriptors(),
      ].map((x) => [x.name.toLowerCase(), x.muscles]),
    );
    const missing = homeLiftNames().filter(
      (x) => !muscles.get(x.toLowerCase())?.length,
    );
    expect(missing).toEqual([]);
  });

  it('adds only lifts the library lacks', () => {
    const known = new Set(library.exercises.map((x) => x.name.toLowerCase()));
    expect(
      homeDescriptors().filter((x) => known.has(x.name.toLowerCase())),
    ).toEqual([]);
  });
});
