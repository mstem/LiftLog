import { describe, expect, it } from 'vitest';
import { LocalDate } from '@js-joda/core';
import { createAddEffectTestBed } from '@/utils/__test__/add-effect-testbed';
import { applyStoredSessionsEffects } from '@/store/stored-sessions/effects';
import {
  renameExercise,
  setExerciseNotes,
  updateExercise,
  upsertStoredSessions,
} from '@/store/stored-sessions';
import { upsertSavedPlans } from '@/store/program';
import { setCurrentSession } from '@/store/current-session';
import { ProgramBlueprint, SessionBlueprint } from '@/models/blueprint-models';
import {
  makeSession,
  makeWeightedBlueprint,
} from '@/models/session-models/__test__/helpers';
import type { ExerciseDescriptor } from '@/models/exercise-models';

const rows = makeWeightedBlueprint('Seated Cable Rows');
const squat = makeWeightedBlueprint('Hack Squat');
const pastRows = makeSession([rows]);
const pastSquat = makeSession([squat]);
const plan = new ProgramBlueprint(
  'PPL',
  [new SessionBlueprint('Pull', [rows], '')],
  LocalDate.of(2026, 10, 1),
);
const descriptor = (name: string): ExerciseDescriptor => ({
  name,
  category: '',
  equipment: null,
  force: null,
  instructions: '',
  level: 'beginner',
  mechanic: null,
  muscles: [],
});

function testBed(extra?: { notes?: Record<string, string> }) {
  const bed = createAddEffectTestBed({
    initialState: {
      storedSessions: {
        sessions: { [pastRows.id]: pastRows, [pastSquat.id]: pastSquat },
        exerciseNotes: extra?.notes ?? { 'seated cable row': 'Elbows in' },
        savedExercises: { lib1: descriptor('Seated Cable Rows') },
      },
      program: { savedPrograms: { p1: plan.toPOJO() } },
      currentSession: { workoutSession: makeSession([rows]) },
    } as never,
  });
  applyStoredSessionsEffects(bed.addEffect);
  return bed;
}

const rename = { from: 'Seated Cable Rows', to: 'Cable Row (seated)' };

describe('renameExercise', () => {
  it('renames the lift in history, leaving other workouts out of the write', async () => {
    const bed = testBed();
    await bed.dispatchHandled(renameExercise(rename));

    const written = bed.getDispatchedAction(upsertStoredSessions).payload;
    expect(written.map((x) => x.id)).toEqual([pastRows.id]);
    expect(written[0]!.recordedExercises[0]!.blueprint.name).toBe(
      'Cable Row (seated)',
    );
  });

  it('renames it in the plan and the open workout', async () => {
    const bed = testBed();
    await bed.dispatchHandled(renameExercise(rename));

    const plans = bed.getDispatchedAction(upsertSavedPlans).payload;
    expect(plans.p1!.sessions[0]!.exercises[0]!.name).toBe(
      'Cable Row (seated)',
    );
    const current = bed.getDispatchedAction(setCurrentSession).payload;
    expect(current.target).toBe('workoutSession');
    expect(current.session!.recordedExercises[0]!.blueprint.name).toBe(
      'Cable Row (seated)',
    );
  });

  it('moves the notes and the library entry to the new name', async () => {
    const bed = testBed();
    await bed.dispatchHandled(renameExercise(rename));

    const notes = bed.dispatchedActions
      .filter(setExerciseNotes.match)
      .map((x) => x.payload);
    expect(notes).toEqual([
      { exerciseName: 'Cable Row (seated)', notes: 'Elbows in' },
      { exerciseName: 'Seated Cable Rows', notes: '' },
    ]);
    expect(bed.getDispatchedAction(updateExercise).payload).toEqual({
      id: 'lib1',
      exercise: descriptor('Cable Row (seated)'),
    });
  });

  it('keeps notes already under the new name', async () => {
    const bed = testBed({
      notes: {
        'seated cable row': 'Elbows in',
        'cable row (seated)': 'Slow',
      },
    });
    await bed.dispatchHandled(renameExercise(rename));

    const notes = bed.dispatchedActions
      .filter(setExerciseNotes.match)
      .map((x) => x.payload);
    expect(notes).toEqual([{ exerciseName: 'Seated Cable Rows', notes: '' }]);
  });

  it('keeps the notes when only the capitals change', async () => {
    const bed = testBed();
    await bed.dispatchHandled(
      renameExercise({ from: 'Seated Cable Rows', to: 'Seated cable rows' }),
    );

    expect(bed.dispatchedActions.filter(setExerciseNotes.match)).toEqual([]);
    expect(bed.getDispatchedAction(updateExercise).payload.exercise.name).toBe(
      'Seated cable rows',
    );
  });

  it('does nothing for an empty name', async () => {
    const bed = testBed();
    await bed.dispatchHandled(renameExercise({ ...rename, to: ' ' }));

    bed.expectNotDispatched(upsertStoredSessions);
  });
});
