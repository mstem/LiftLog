import { describe, expect, it } from 'vitest';
import { LocalDate } from '@js-joda/core';
import { createAddEffectTestBed } from '@/utils/__test__/add-effect-testbed';
import { applyStoredSessionsEffects } from '@/store/stored-sessions/effects';
import {
  deleteExercise,
  renameExercise,
  setExerciseNotes,
  updateExercise,
  upsertStoredSessions,
} from '@/store/stored-sessions';
import { upsertSavedPlans } from '@/store/program';
import { setStatsIsDirty } from '@/store/stats';
import { setCurrentSession, setExerciseSwaps } from '@/store/current-session';
import { setEditingSession } from '@/store/session-editor';
import { ProgramBlueprint, SessionBlueprint } from '@/models/blueprint-models';
import {
  makeSession,
  makeWeightedBlueprint,
} from '@/models/session-models/__test__/helpers';
import type { ExerciseDescriptor } from '@/models/exercise-models';
import type { ExerciseSwap } from '@/models/exercise-swap';

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

function testBed(extra?: {
  notes?: Record<string, string>;
  library?: Record<string, ExerciseDescriptor>;
  draft?: SessionBlueprint;
  swaps?: Record<string, ExerciseSwap[]>;
}) {
  const bed = createAddEffectTestBed({
    initialState: {
      storedSessions: {
        sessions: { [pastRows.id]: pastRows, [pastSquat.id]: pastSquat },
        exerciseNotes: extra?.notes ?? { 'seated cable row': 'Elbows in' },
        savedExercises: extra?.library ?? {
          lib1: descriptor('Seated Cable Rows'),
        },
      },
      program: { savedPrograms: { p1: plan.toPOJO() } },
      sessionEditor: { sessionBlueprint: extra?.draft },
      currentSession: {
        workoutSession: makeSession([rows]),
        exerciseSwaps: extra?.swaps ?? {},
      },
    },
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

  it('joins the notes when both names have some, so none are lost', async () => {
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
    expect(notes).toEqual([
      { exerciseName: 'Cable Row (seated)', notes: 'Slow\n\nElbows in' },
      { exerciseName: 'Seated Cable Rows', notes: '' },
    ]);
  });

  it('drops the old library entry when the new name already has one', async () => {
    const bed = testBed({
      library: {
        lib1: descriptor('Seated Cable Rows'),
        lib2: descriptor('Cable Row (seated)'),
      },
    });
    await bed.dispatchHandled(renameExercise(rename));

    expect(bed.getDispatchedAction(deleteExercise).payload).toBe('lib1');
    bed.expectNotDispatched(updateExercise);
  });

  it('moves every library entry with the old name, keeping one', async () => {
    const bed = testBed({
      library: {
        lib1: descriptor('Seated Cable Rows'),
        lib3: descriptor('Seated Cable Row'),
      },
    });
    await bed.dispatchHandled(renameExercise(rename));

    expect(bed.getDispatchedAction(updateExercise).payload.id).toBe('lib1');
    expect(bed.getDispatchedAction(deleteExercise).payload).toBe('lib3');
  });

  it('keeps every library entry when only the capitals change', async () => {
    const bed = testBed({
      library: {
        lib1: descriptor('Seated Cable Rows'),
        lib3: descriptor('seated cable row'),
      },
    });
    await bed.dispatchHandled(
      renameExercise({ from: 'Seated Cable Rows', to: 'Seated cable rows' }),
    );

    bed.expectNotDispatched(deleteExercise);
  });

  it('marks the stats out of date, so they show the new name', async () => {
    const bed = testBed();
    await bed.dispatchHandled(renameExercise(rename));

    expect(bed.getDispatchedAction(setStatsIsDirty).payload).toBe(true);
  });

  it('writes no sessions when none name the lift', async () => {
    const bed = testBed();
    await bed.dispatchHandled(renameExercise({ from: 'Deadlift', to: 'X' }));

    bed.expectNotDispatched(upsertStoredSessions);
  });

  it('renames the lift in the workout swaps, so Finish still undoes them', async () => {
    const bed = testBed({
      swaps: { w1: [{ swappedIn: 'Seated Cable Rows', original: squat }] },
    });
    await bed.dispatchHandled(renameExercise(rename));

    const written = bed.getDispatchedAction(setExerciseSwaps).payload;
    expect(written.sessionId).toBe('w1');
    expect(written.swaps[0]!.swappedIn).toBe('Cable Row (seated)');
  });

  it('renames every entry of the lift in the plan being edited', async () => {
    const draft = new SessionBlueprint('Pull', [rows, squat, rows], '');
    const bed = testBed({ draft });
    await bed.dispatchHandled(renameExercise(rename));

    const edited = bed.getDispatchedAction(setEditingSession).payload!;
    expect(edited.exercises.map((x) => x.name)).toEqual([
      'Cable Row (seated)',
      'Hack Squat',
      'Cable Row (seated)',
    ]);
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
