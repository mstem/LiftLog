import { describe, expect, it } from 'vitest';
import { renameFrom } from './rename-from';

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
