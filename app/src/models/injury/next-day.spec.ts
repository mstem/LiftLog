import { describe, it, expect } from 'vitest';
import BigNumber from 'bignumber.js';
import { LocalDate, OffsetDateTime } from '@js-joda/core';
import {
  IncreaseAllEvenlyProgressiveOverload,
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
import { REHAB_GROUP } from '@/models/injury/rehab';
import { pendingNextDayCheck } from '@/models/injury/next-day';

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
const press = blueprint('Standing Military Press');
const squat = blueprint('Barbell Squat');
const supinePunch = blueprint('Supine punch', REHAB_GROUP);

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

const lastSetAt = '2026-05-05T18:00:00Z';
const hoursAfter = (h: number) => OffsetDateTime.parse(lastSetAt).plusHours(h);

function session(
  id: string,
  date: string,
  lifts: WeightedExerciseBlueprint[],
  completedAt = lastSetAt,
): Session {
  const exercises = lifts.map(
    (bp) =>
      new RecordedWeightedExercise(
        bp,
        [
          new PotentialSet(
            new RecordedSet(8, OffsetDateTime.parse(completedAt)),
            new Weight(20, 'kilograms'),
          ),
        ],
        undefined,
      ),
  );
  return new Session(
    id,
    new SessionBlueprint('Push', lifts, ''),
    exercises,
    LocalDate.parse(date),
    undefined,
    undefined,
  );
}

const base = { injury, answers: {}, overrides: {} };

describe('pendingNextDayCheck', () => {
  it('returns a session 13 hours old with a ticked flagged lift', () => {
    const s = session('a', '2026-05-05', [press]);
    expect(
      pendingNextDayCheck({ ...base, sessions: [s], now: hoursAfter(13) }),
    ).toBe(s);
  });

  it('does not return the same session 11 hours old', () => {
    const s = session('a', '2026-05-05', [press]);
    expect(
      pendingNextDayCheck({ ...base, sessions: [s], now: hoursAfter(11) }),
    ).toBeUndefined();
  });

  it('does not return an answered session', () => {
    const s = session('a', '2026-05-05', [press]);
    expect(
      pendingNextDayCheck({
        ...base,
        answers: { a: 'notWorse' },
        sessions: [s],
        now: hoursAfter(13),
      }),
    ).toBeUndefined();
  });

  it('does not return a session with only unflagged lifts', () => {
    const s = session('a', '2026-05-05', [squat]);
    expect(
      pendingNextDayCheck({ ...base, sessions: [s], now: hoursAfter(13) }),
    ).toBeUndefined();
  });

  it('returns a session whose only tracked lift is in the Rehab group', () => {
    const s = session('a', '2026-05-05', [squat, supinePunch]);
    expect(
      pendingNextDayCheck({ ...base, sessions: [s], now: hoursAfter(13) }),
    ).toBe(s);
  });

  it('returns undefined with no active injury', () => {
    const s = session('a', '2026-05-05', [press]);
    expect(
      pendingNextDayCheck({
        ...base,
        injury: undefined,
        sessions: [s],
        now: hoursAfter(13),
      }),
    ).toBeUndefined();
  });

  it('ignores sessions dated before onset', () => {
    const s = session('a', '2026-04-20', [press], '2026-04-20T18:00:00Z');
    expect(
      pendingNextDayCheck({ ...base, sessions: [s], now: hoursAfter(13) }),
    ).toBeUndefined();
  });

  it('returns the most recent eligible session', () => {
    const older = session('old', '2026-05-03', [press], '2026-05-03T18:00:00Z');
    const newer = session('new', '2026-05-05', [press]);
    expect(
      pendingNextDayCheck({
        ...base,
        sessions: [older, newer],
        now: hoursAfter(13),
      }),
    ).toBe(newer);
  });

  it('does not fall back to an older unanswered session when the latest is answered', () => {
    const older = session('old', '2026-05-03', [press], '2026-05-03T18:00:00Z');
    const newer = session('new', '2026-05-05', [press]);
    expect(
      pendingNextDayCheck({
        ...base,
        answers: { new: 'worse' },
        sessions: [older, newer],
        now: hoursAfter(13),
      }),
    ).toBeUndefined();
  });

  it('does not fall back to an older session when the latest is under 12 hours old', () => {
    const older = session('old', '2026-05-03', [press], '2026-05-03T18:00:00Z');
    const newer = session('new', '2026-05-05', [press]);
    expect(
      pendingNextDayCheck({
        ...base,
        sessions: [older, newer],
        now: hoursAfter(11),
      }),
    ).toBeUndefined();
  });
  it('never asks about a session from before the mode was turned on', () => {
    const s = session('a', '2026-05-05', [press]);
    expect(
      pendingNextDayCheck({
        ...base,
        injury: { ...injury, trackedFrom: '2026-05-06T08:00:00Z' },
        sessions: [s],
        now: hoursAfter(30),
      }),
    ).toBeUndefined();
  });
});
