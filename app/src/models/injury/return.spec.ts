import { describe, it, expect } from 'vitest';
import BigNumber from 'bignumber.js';
import { LocalDate, OffsetDateTime } from '@js-joda/core';
import {
  IncreaseAllEvenlyProgressiveOverload,
  NormalizedName,
  Rest,
  SessionBlueprint,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import {
  PotentialSet,
  RecordedSet,
  RecordedWeightedExercise,
  Session,
} from '@/models/session-models';
import { Weight } from '@/models/weight';
import { Injury } from '@/models/injury/injury';
import {
  PAUSED_GROUP,
  REHAB_GROUP,
  returnedLiftNames,
  withPullLiftsPaused,
} from '@/models/injury/rehab';
import { returnedLiftCount, returnRank } from '@/models/injury/return';

const blueprint = (name: string, group?: string) =>
  new WeightedExerciseBlueprint(
    name,
    3,
    8,
    new IncreaseAllEvenlyProgressiveOverload(BigNumber(2.5)),
    Rest.medium,
    false,
    '',
    '',
    group,
  );
const press = blueprint('Incline Bench Press (Barbell)');
const legPress = blueprint('Leg Press');
const punch = blueprint('Supine punch', REHAB_GROUP);

const injury: Injury = {
  slug: 'shoulder',
  name: 'Shoulder',
  side: 'left',
  structures: [],
  onsetDate: '2026-04-25',
  painLimit: 5,
  firstCut: 0.5,
  status: 'active',
  screenFindings: undefined,
  trackedFrom: '2026-04-25T00:00:00Z',
};

/** A session of one lift per entry, each with the given pain scores. */
function session(
  id: string,
  name: string,
  date: string,
  lifts: [WeightedExerciseBlueprint, (number | undefined)[]][],
  stoppedForPain = false,
): Session {
  const at = OffsetDateTime.parse(`${date}T18:00:00Z`);
  const exercises = lifts.map(
    ([bp, pains]) =>
      new RecordedWeightedExercise(
        bp,
        pains.map(
          (pain) =>
            new PotentialSet(
              new RecordedSet(8, at, pain),
              new Weight(20, 'kilograms'),
            ),
        ),
        undefined,
        stoppedForPain,
      ),
  );
  return new Session(
    id,
    new SessionBlueprint(
      name,
      lifts.map(([bp]) => bp),
      '',
    ),
    exercises,
    LocalDate.parse(date),
    undefined,
    undefined,
  );
}

const quietPush = (id: string, date: string) =>
  session(id, 'Push', date, [[press, [1, 2, 3]]]);
const quietPull = (id: string, date: string) =>
  session(id, 'Pull', date, [[punch, [0, 1]]]);
const notWorse = (...ids: string[]) =>
  Object.fromEntries(ids.map((id) => [id, 'notWorse' as const]));

describe('returnRank', () => {
  it('brings rows back first and overhead work last', () => {
    const order = [
      'Pullups',
      'Band Pull Apart',
      'Wide-Grip Lat Pulldown',
      'Bent Over Barbell Row',
      'Inverted Row',
      'Seated Cable Rows',
    ].sort((a, b) => returnRank(a) - returnRank(b));
    expect(order).toEqual([
      'Seated Cable Rows',
      'Inverted Row',
      'Bent Over Barbell Row',
      'Band Pull Apart',
      'Wide-Grip Lat Pulldown',
      'Pullups',
    ]);
  });
});

describe('returnedLiftCount', () => {
  const count = (
    sessions: Session[],
    answers: Record<string, 'worse' | 'notWorse'> = {},
  ) => returnedLiftCount({ sessions, injury, overrides: {}, answers });

  it('is zero with no history', () => {
    expect(count([])).toBe(0);
  });

  it('earns one lift after two quiet answered sessions', () => {
    const s = [quietPush('a', '2026-05-01'), quietPush('b', '2026-05-03')];
    expect(count(s, notWorse('a', 'b'))).toBe(1);
  });

  it('does not count the latest session until its morning is answered', () => {
    const s = [quietPush('a', '2026-05-01'), quietPush('b', '2026-05-03')];
    expect(count(s, notWorse('a'))).toBe(0);
  });

  it('treats an older unanswered session as quiet', () => {
    const s = [quietPush('a', '2026-05-01'), quietPush('b', '2026-05-03')];
    expect(count(s, notWorse('b'))).toBe(1);
  });

  it('a set above the threshold breaks the streak', () => {
    const s = [
      quietPush('a', '2026-05-01'),
      session('b', 'Push', '2026-05-03', [[press, [1, 4]]]),
    ];
    expect(count(s, notWorse('a', 'b'))).toBe(0);
    const again = [...s, quietPush('c', '2026-05-05')];
    expect(count(again, notWorse('a', 'b', 'c'))).toBe(0);
    const twice = [...again, quietPush('d', '2026-05-07')];
    expect(count(twice, notWorse('a', 'b', 'c', 'd'))).toBe(1);
  });

  it('skipped pain questions do not break the streak', () => {
    const s = [
      session('a', 'Push', '2026-05-01', [[press, [undefined, 2]]]),
      quietPush('b', '2026-05-03'),
    ];
    expect(count(s, notWorse('a', 'b'))).toBe(1);
  });

  it('returns one more lift per quiet pull day', () => {
    const s = [
      quietPush('a', '2026-05-01'),
      quietPush('b', '2026-05-03'),
      quietPull('c', '2026-05-05'),
      quietPull('d', '2026-05-07'),
    ];
    expect(count(s, notWorse('a', 'b', 'c', 'd'))).toBe(3);
  });

  it('a pull day that is not quiet keeps its lift but earns no more', () => {
    const s = [
      quietPush('a', '2026-05-01'),
      quietPush('b', '2026-05-03'),
      session('c', 'Pull', '2026-05-05', [[punch, [4]]]),
    ];
    expect(count(s, notWorse('a', 'b', 'c'))).toBe(1);
  });

  it('a worse morning sends the last returnee back and restarts the count', () => {
    const s = [
      quietPush('a', '2026-05-01'),
      quietPush('b', '2026-05-03'),
      quietPull('c', '2026-05-05'),
      quietPush('d', '2026-05-07'),
    ];
    expect(count(s, { ...notWorse('a', 'b', 'c'), d: 'worse' })).toBe(0);
    const after = [...s, quietPush('e', '2026-05-09')];
    expect(count(after, { ...notWorse('a', 'b', 'c', 'e'), d: 'worse' })).toBe(
      0,
    );
  });

  it('a lift stopped for pain does the same', () => {
    const s = [
      quietPush('a', '2026-05-01'),
      quietPush('b', '2026-05-03'),
      quietPull('c', '2026-05-05'),
      session('d', 'Push', '2026-05-07', [[press, [2, 6]]], true),
    ];
    expect(count(s, notWorse('a', 'b', 'c', 'd'))).toBe(0);
  });

  it('never goes below zero', () => {
    const s = [session('a', 'Push', '2026-05-01', [[press, [6]]], true)];
    expect(count(s, notWorse('a'))).toBe(0);
  });

  it('ignores sessions with no tracked lift, before onset, or before tracking began', () => {
    const tracked = { ...injury, trackedFrom: '2026-05-02T00:00:00Z' };
    const s = [
      session('legs', 'Legs', '2026-05-01', [[legPress, [0]]]),
      quietPush('old', '2026-04-20'),
      quietPush('early', '2026-05-01'),
      quietPush('a', '2026-05-03'),
      quietPush('b', '2026-05-05'),
    ];
    expect(
      returnedLiftCount({
        sessions: s,
        injury: tracked,
        overrides: {},
        answers: notWorse('legs', 'old', 'early', 'a', 'b'),
      }),
    ).toBe(1);
    expect(
      returnedLiftCount({
        sessions: s.slice(0, 4),
        injury: tracked,
        overrides: {},
        answers: notWorse('legs', 'old', 'early', 'a'),
      }),
    ).toBe(0);
  });
});

describe('withPullLiftsPaused with returned lifts', () => {
  const pull = new SessionBlueprint(
    'Pull',
    [
      blueprint('Band Pull Apart'),
      blueprint('Pullups'),
      blueprint('Inverted Row'),
      blueprint('Wide-Grip Lat Pulldown'),
      blueprint('Bent Over Barbell Row'),
      blueprint('Seated Cable Rows'),
      blueprint('Dumbbell Bicep Curl'),
    ],
    '',
  );
  const pausedNames = (bp: SessionBlueprint) =>
    bp.exercises.filter((x) => x.group === PAUSED_GROUP).map((x) => x.name);

  it('leaves the first lifts in return order unpaused', () => {
    const out = withPullLiftsPaused(pull, {}, { count: 2, overrides: {} });
    expect(pausedNames(out)).toEqual([
      'Band Pull Apart',
      'Pullups',
      'Wide-Grip Lat Pulldown',
      'Bent Over Barbell Row',
    ]);
    expect(
      out.exercises.find((x) => x.name === 'Seated Cable Rows')?.group,
    ).toBeUndefined();
  });

  it('a hand return is extra and a hand pause is skipped over', () => {
    const key = (name: string) => new NormalizedName(name).toString();
    const names = returnedLiftNames(
      pull,
      {},
      {
        count: 1,
        overrides: {
          [key('Pullups')]: 'returned',
          [key('Seated Cable Rows')]: 'paused',
        },
      },
    );
    expect(names).toEqual([key('Pullups'), key('Inverted Row')]);
  });

  it('with nothing returned it pauses as before', () => {
    expect(pausedNames(withPullLiftsPaused(pull, {}))).toHaveLength(6);
  });
});
