import { describe, expect, it } from 'vitest';
import { renameFrom, savedNameInPlan } from './rename-from';

describe('renameFrom', () => {
  it('offers no rename while adding a lift', () => {
    expect(renameFrom(undefined, 'Bench Press')).toBeUndefined();
  });

  it('renames the saved lift being edited', () => {
    expect(renameFrom('Bench Press', 'Bench Press')).toBe('Bench Press');
  });

  it('offers no rename once another lift is picked but not saved', () => {
    expect(renameFrom('Squat', 'Front Squat')).toBeUndefined();
  });
});

describe('savedNameInPlan', () => {
  it('is the name of a lift the saved plan has', () => {
    expect(savedNameInPlan(['Squat', 'Bench'], 'Bench')).toBe('Bench');
  });

  it('is unset for a lift just added to the plan being edited', () => {
    expect(savedNameInPlan(['Squat', 'Bench'], 'Exercise 3')).toBeUndefined();
  });
});
