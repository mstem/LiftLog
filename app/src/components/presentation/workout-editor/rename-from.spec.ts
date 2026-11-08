import { describe, expect, it } from 'vitest';
import { hasLoggedHistory, renameFrom } from './rename-from';

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
