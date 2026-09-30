import { describe, expect, it } from 'vitest';
import {
  LocalDate,
  OffsetDateTime,
  ZoneOffset,
  YearMonth,
} from '@js-joda/core';
import { v4 as uuid } from 'uuid';
import {
  selectExerciseNotes,
  selectRecentlyCompletedExercises,
  selectSessionsInMonth,
  setExerciseNotes,
  storedSessionsReducer,
} from '@/store/stored-sessions';
import {
  CardioExerciseBlueprint,
  NoProgressiveOverload,
  Rest,
  SessionBlueprint,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import {
  PotentialSet,
  RecordedCardioExercise,
  RecordedSet,
  RecordedWeightedExercise,
  Session,
} from '@/models/session-models';
import { Weight } from '@/models/weight';
import { makeCardioSetBlueprint } from '@/models/session-models/__test__/helpers';

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

describe('recently completed exercises', () => {
  // Pigeon was a timed stretch and became a ticked one: its history is cardio,
  // the exercise now being done is weighted. Handing the cardio records to the
  // weighted exercise crashed the workout screen on start.
  const timedPigeon = new CardioExerciseBlueprint(
    'Pigeon',
    [makeCardioSetBlueprint()],
    '',
    '',
  );
  const tickedPigeon = new WeightedExerciseBlueprint(
    'Pigeon',
    2,
    1,
    new NoProgressiveOverload(),
    Rest.medium,
    false,
    '',
    '',
  );
  const done = OffsetDateTime.of(2026, 9, 27, 10, 0, 0, 0, ZoneOffset.UTC);
  const timedRecord = new RecordedCardioExercise(
    timedPigeon,
    RecordedCardioExercise.empty(timedPigeon).sets.map((x) =>
      x.with({ completionDateTime: done }),
    ),
    undefined,
  );
  const session = new Session(
    uuid(),
    new SessionBlueprint('Legs', [timedPigeon], ''),
    [timedRecord],
    LocalDate.of(2026, 9, 27),
    undefined,
    undefined,
  );
  const state = { storedSessions: { sessions: { [session.id]: session } } };

  it('does not give a weighted exercise the history of a timed one with the same name', () => {
    const lookup = selectRecentlyCompletedExercises(state, 10);

    expect(lookup(tickedPigeon)).toEqual([]);
  });

  it('still gives the timed exercise its own history', () => {
    const lookup = selectRecentlyCompletedExercises(state, 10);

    expect(lookup(timedPigeon)).toEqual([timedRecord]);
  });
});
