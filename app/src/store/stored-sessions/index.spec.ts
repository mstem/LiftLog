import { describe, expect, it } from 'vitest';
import {
  LocalDate,
  OffsetDateTime,
  ZoneOffset,
  YearMonth,
} from '@js-joda/core';
import { v4 as uuid } from 'uuid';
import {
  selectAverageSessionsPerMonth,
  upsertStoredSessions,
  selectExerciseNotes,
  selectSessionsInMonth,
  setExerciseNotes,
  storedSessionsReducer,
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

function createSessionWithCompletionTime(
  sessionDate: LocalDate,
  completionTime: OffsetDateTime,
  name: string,
) {
  const blueprint = new SessionBlueprint(
    name,
    [
      new WeightedExerciseBlueprint(
        `${name} Exercise`,
        1,
        5,
        new NoProgressiveOverload(),
        Rest.medium,
        false,
        '',
        '',
      ),
    ],
    '',
  );
  const exerciseBlueprint = blueprint.exercises[0] as WeightedExerciseBlueprint;
  const recordedExercise = new RecordedWeightedExercise(
    exerciseBlueprint,
    [
      new PotentialSet(
        new RecordedSet(exerciseBlueprint.repsPerSet, completionTime),
        new Weight(100, 'kilograms'),
      ),
    ],
    undefined,
  );

  return new Session(
    uuid(),
    blueprint,
    [recordedExercise],
    sessionDate,
    undefined,
    undefined,
  );
}

describe('stored sessions sorting', () => {
  it('sorts sessions in a month by the actual completion time, not only the date', () => {
    const sameDay = LocalDate.of(2026, 4, 10);
    const earlier = createSessionWithCompletionTime(
      sameDay,
      OffsetDateTime.of(2026, 4, 10, 8, 30, 0, 0, ZoneOffset.UTC),
      'Morning',
    );
    const later = createSessionWithCompletionTime(
      sameDay,
      OffsetDateTime.of(2026, 4, 10, 18, 15, 0, 0, ZoneOffset.UTC),
      'Evening',
    );

    const state = {
      storedSessions: {
        sessions: {
          [earlier.id]: earlier,
          [later.id]: later,
        },
      },
    };

    const ordered = selectSessionsInMonth(state, YearMonth.of(2026, 4));

    expect(ordered.map((session) => session.blueprint.name)).toEqual([
      'Evening',
      'Morning',
    ]);
  });
});

describe('exercise notes', () => {
  it('stores notes keyed by normalized exercise name so they match across workouts', () => {
    const state = storedSessionsReducer(
      undefined,
      setExerciseNotes({ exerciseName: 'Bicep Curls', notes: 'Elbows in' }),
    );

    expect(selectExerciseNotes({ storedSessions: state }, 'bicep curl')).toBe(
      'Elbows in',
    );
    expect(
      selectExerciseNotes({ storedSessions: state }, 'Lat Pulldown'),
    ).toBeUndefined();
  });

  it('removes notes when they are set to empty text', () => {
    let state = storedSessionsReducer(
      undefined,
      setExerciseNotes({ exerciseName: 'Bicep Curls', notes: 'Elbows in' }),
    );
    state = storedSessionsReducer(
      state,
      setExerciseNotes({ exerciseName: 'bicep curl', notes: '  ' }),
    );

    expect(
      selectExerciseNotes({ storedSessions: state }, 'Bicep Curls'),
    ).toBeUndefined();
  });
});

describe('average sessions per month', () => {
  function stateWithSessionsOn(dates: LocalDate[]) {
    const sessions = dates.map((date, i) =>
      createSessionWithCompletionTime(
        date,
        OffsetDateTime.of(
          date.year(),
          date.monthValue(),
          date.dayOfMonth(),
          12,
          0,
          0,
          0,
          ZoneOffset.UTC,
        ),
        `Session ${i}`,
      ),
    );
    return {
      storedSessions: storedSessionsReducer(
        undefined,
        upsertStoredSessions(sessions),
      ),
    };
  }

  it('divides the sessions by the number of months they span', () => {
    const state = stateWithSessionsOn([
      LocalDate.of(2026, 1, 5),
      LocalDate.of(2026, 1, 20),
      LocalDate.of(2026, 2, 3),
      LocalDate.of(2026, 3, 28),
    ]);

    // 4 sessions over January, February and March
    expect(selectAverageSessionsPerMonth(state)).toBeCloseTo(4 / 3, 5);
  });

  it('counts a single month of sessions as one month', () => {
    const state = stateWithSessionsOn([
      LocalDate.of(2026, 4, 1),
      LocalDate.of(2026, 4, 15),
    ]);

    expect(selectAverageSessionsPerMonth(state)).toBe(2);
  });

  it('counts months with no sessions in them', () => {
    const state = stateWithSessionsOn([
      LocalDate.of(2026, 1, 10),
      LocalDate.of(2026, 5, 10),
    ]);

    expect(selectAverageSessionsPerMonth(state)).toBeCloseTo(2 / 5, 5);
  });

  it('is zero with nothing recorded', () => {
    expect(selectAverageSessionsPerMonth(stateWithSessionsOn([]))).toBe(0);
  });

  it('skips sessions with no exercises recorded in them', () => {
    const recorded = createSessionWithCompletionTime(
      LocalDate.of(2026, 6, 4),
      OffsetDateTime.of(2026, 6, 4, 12, 0, 0, 0, ZoneOffset.UTC),
      'Recorded',
    );
    const empty = new Session(
      uuid(),
      recorded.blueprint,
      [],
      LocalDate.of(2026, 6, 11),
      undefined,
      undefined,
    );
    const state = {
      storedSessions: storedSessionsReducer(
        undefined,
        upsertStoredSessions([recorded, empty]),
      ),
    };

    expect(selectAverageSessionsPerMonth(state)).toBe(1);
  });
});
