import { describe, expect, it } from 'vitest';
import { hasLoggedHistory, mergesInto, renameFrom } from './rename-from';

describe('renameFrom', () => {
  it('offers no rename while adding a lift', () => {
    expect(renameFrom(undefined, 'Bench Press', true)).toBeUndefined();
  });

  it('renames the saved lift being edited', () => {
    expect(renameFrom('Bench Press', 'Bench Press', true)).toBe('Bench Press');
  });

  it('offers no rename once another lift is picked but not saved', () => {
    expect(renameFrom('Squat', 'Front Squat', true)).toBeUndefined();
  });

  it('offers no rename on a lift with no history, such as a new placeholder', () => {
    expect(renameFrom('Exercise 4', 'Exercise 4', false)).toBeUndefined();
  });
});

describe('hasLoggedHistory', () => {
  const session = (name: string, isStarted: boolean) => ({
    recordedExercises: [{ isStarted, blueprint: { name } }],
  });

  it('is true when a set of the lift was done, whatever the capitals or plural', () => {
    expect(
      hasLoggedHistory(
        [session('Seated Cable Rows', true)],
        'seated cable row',
      ),
    ).toBe(true);
  });

  it('is false when the lift was only planned and skipped', () => {
    expect(hasLoggedHistory([session('Exercise 4', false)], 'Exercise 4')).toBe(
      false,
    );
  });

  it('is false with no name', () => {
    expect(hasLoggedHistory([session('Squat', true)], undefined)).toBe(false);
  });
});

describe('mergesInto', () => {
  const names = ['Squat', 'Hack Squat', 'Bench Press'];

  it('names the other lift a rename would combine with', () => {
    expect(mergesInto('hack squat', 'Squat', names)).toBe('Hack Squat');
  });

  it('is unset for a new name', () => {
    expect(mergesInto('Back Squat', 'Squat', names)).toBeUndefined();
  });

  it('is unset when only the capitals of the same lift change', () => {
    expect(mergesInto('squat', 'Squat', names)).toBeUndefined();
  });
});
