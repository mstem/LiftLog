import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DayOfWeek, LocalDate, OffsetDateTime, YearMonth } from '@js-joda/core';
import { createAddEffectTestBed } from '@/utils/__test__/add-effect-testbed';
import { applyStoredSessionsEffects } from '@/store/stored-sessions/effects';
import {
  deleteStoredSession,
  refreshMonthlyReportNotification,
  setIsHydrated,
  setStoredSessions,
  upsertStoredSessions,
} from '@/store/stored-sessions';
import {
  NoProgressiveOverload,
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

function workout(date: string) {
  const squat = new RecordedWeightedExercise(
    new WeightedExerciseBlueprint(
      'Barbell Squat',
      1,
      10,
      new NoProgressiveOverload(),
      Rest.medium,
      false,
      '',
      '',
    ),
    [
      new PotentialSet(
        new RecordedSet(10, OffsetDateTime.parse(`${date}T10:00:00Z`)),
        new Weight(100, 'kilograms'),
      ),
    ],
    undefined,
  );
  return new Session(
    `legs-${date}`,
    new SessionBlueprint('Legs', [squat.blueprint], ''),
    [squat],
    LocalDate.parse(date),
    undefined,
    undefined,
  );
}

function testBed(opts: {
  enabled: boolean;
  sessions: Session[];
  hydrated?: boolean;
}) {
  const schedule = vi.fn(async () => {});
  const cancel = vi.fn(async () => {});
  const bed = createAddEffectTestBed({
    initialState: {
      settings: {
        monthlyReportNotifications: opts.enabled,
        useImperialUnits: false,
        firstDayOfWeek: DayOfWeek.MONDAY,
        preferredLanguage: 'en',
      },
      storedSessions: {
        isHydrated: opts.hydrated ?? true,
        sessions: Object.fromEntries(opts.sessions.map((s) => [s.id, s])),
        savedExercises: {},
      },
    },
    services: {
      monthlyReportNotifier: { schedule, cancel },
      tolgee: {
        t: (key: string, params: Record<string, unknown>) =>
          `${key} ${JSON.stringify(params)}`,
      },
    },
  });
  applyStoredSessionsEffects(bed.addEffect);
  return { bed, schedule, cancel };
}

describe('refreshMonthlyReportNotification', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(2026, 9, 17, 12, 0), toFake: ['Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules this month's numbers for 09:00 on the 1st of next month", async () => {
    const { bed, schedule } = testBed({
      enabled: true,
      sessions: [
        workout('2026-09-30'),
        workout('2026-10-02'),
        workout('2026-10-09'),
      ],
    });
    await bed.dispatchHandled(refreshMonthlyReportNotification());

    expect(schedule).toHaveBeenCalledTimes(1);
    const args = (
      schedule.mock.calls[0] as unknown as [
        { month: YearMonth; at: Date; title: string; body: string },
      ]
    )[0];
    expect(args.month.toString()).toBe('2026-10');
    expect(args.at).toEqual(new Date(2026, 10, 1, 9, 0));
    expect(args.title).toContain('"month":"October"');
    expect(args.body).toContain('"workouts":2');
    expect(args.body).toContain('"sets":2');
  });

  it("cancels only this month's pending report when it has no workouts", async () => {
    const { bed, schedule, cancel } = testBed({
      enabled: true,
      sessions: [workout('2026-09-30')],
    });
    await bed.dispatchHandled(refreshMonthlyReportNotification());

    expect(schedule).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledTimes(1);
    const month = (cancel.mock.calls[0] as unknown as [YearMonth])[0];
    expect(month.toString()).toBe('2026-10');
  });

  it.each([
    ['deleting a workout', () => deleteStoredSession('legs-2026-10-02')],
    ['loading history', () => setStoredSessions({})],
    ['changing stored workouts', () => upsertStoredSessions([])],
    ['finishing startup', () => setIsHydrated(true)],
  ])('refreshes the report after %s', async (_, action) => {
    const { bed } = testBed({ enabled: true, sessions: [] });
    await bed.dispatchHandled(action());

    expect(
      bed.dispatchedActions.some(refreshMonthlyReportNotification.match),
    ).toBe(true);
  });

  it('leaves the queued report alone until history has loaded', async () => {
    const { bed, schedule, cancel } = testBed({
      enabled: true,
      sessions: [],
      hydrated: false,
    });
    await bed.dispatchHandled(refreshMonthlyReportNotification());

    expect(schedule).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it('cancels pending reports when switched off', async () => {
    const { bed, schedule, cancel } = testBed({
      enabled: false,
      sessions: [workout('2026-10-02')],
    });
    await bed.dispatchHandled(refreshMonthlyReportNotification());

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(schedule).not.toHaveBeenCalled();
  });
});
