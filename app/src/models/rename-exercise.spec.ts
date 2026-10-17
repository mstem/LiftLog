import { describe, expect, it } from 'vitest';
import { LocalDate } from '@js-joda/core';
import { ProgramBlueprint, SessionBlueprint } from '@/models/blueprint-models';
import {
  makeCardioBlueprint,
  makeSession,
  makeWeightedBlueprint,
  tick,
} from '@/models/session-models/__test__/helpers';
import { renameInProgram, renameInSession } from '@/models/rename-exercise';

const rename = { from: 'Seated Cable Rows', to: 'Cable Row (seated)' };

describe('renameInSession', () => {
  it('renames the lift in the recorded sets and the workout, keeping its sets', () => {
    const session = makeSession([
      makeWeightedBlueprint('Seated Cable Rows'),
      makeWeightedBlueprint('Pullups'),
    ]).withCycledExerciseReps(0, 0, tick());

    const out = renameInSession(session, rename);

    expect(out.recordedExercises.map((x) => x.blueprint.name)).toEqual([
      'Cable Row (seated)',
      'Pullups',
    ]);
    expect(out.blueprint.exercises.map((x) => x.name)).toEqual([
      'Cable Row (seated)',
      'Pullups',
    ]);
    expect(out.recordedExercises[0]!.isStarted).toBe(true);
    expect(out.id).toBe(session.id);
  });

  it('matches the name the way history does: case and plurals do not matter', () => {
    const session = makeSession([makeWeightedBlueprint('seated cable row')]);

    expect(
      renameInSession(session, rename).recordedExercises[0]!.blueprint.name,
    ).toBe('Cable Row (seated)');
  });

  it('renames a cardio exercise too', () => {
    const session = makeSession([makeCardioBlueprint()]);

    expect(
      renameInSession(session, { from: 'Row', to: 'Rowing machine' })
        .recordedExercises[0]!.blueprint.name,
    ).toBe('Rowing machine');
  });

  it('gives back the same session when the lift is not in it', () => {
    const session = makeSession([makeWeightedBlueprint('Pullups')]);

    expect(renameInSession(session, rename)).toBe(session);
  });
});

describe('renameInProgram', () => {
  const program = new ProgramBlueprint(
    'PPL',
    [
      new SessionBlueprint(
        'Pull',
        [makeWeightedBlueprint('Seated Cable Rows')],
        '',
      ),
      new SessionBlueprint('Legs', [makeWeightedBlueprint('Hack Squat')], ''),
    ],
    LocalDate.of(2026, 10, 1),
  );

  it('renames the lift in every workout of the plan', () => {
    const out = renameInProgram(program, rename);

    expect(out.sessions[0]!.exercises[0]!.name).toBe('Cable Row (seated)');
    expect(out.sessions[1]).toBe(program.sessions[1]);
  });

  it('gives back the same plan when the lift is not in it', () => {
    expect(renameInProgram(program, { from: 'Curl', to: 'Bicep Curl' })).toBe(
      program,
    );
  });
});
