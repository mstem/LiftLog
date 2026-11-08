import { describe, expect, it } from 'vitest';
import { libraryRenames, pendingLibraryRenames } from './library-renames';

describe('libraryRenames', () => {
  it('folds the Suspended lifts into the TRX set', () => {
    expect(libraryRenames).toEqual([
      { from: 'Suspended Row', to: 'TRX Row' },
      { from: 'Suspended Push-Up', to: 'TRX Push-Up' },
      { from: 'Suspended Split Squat', to: 'TRX Suspended Lunge' },
      { from: 'Suspended Reverse Crunch', to: 'TRX Knee Tuck' },
      { from: 'Suspended Fallout', to: 'TRX Fallout' },
    ]);
  });
});

describe('pendingLibraryRenames', () => {
  it('keeps only renames whose old name is still somewhere', () => {
    expect(
      pendingLibraryRenames(['TRX Row', 'suspended fallout', 'Squat']),
    ).toEqual([{ from: 'Suspended Fallout', to: 'TRX Fallout' }]);
  });

  it('is empty once every old name is gone', () => {
    expect(pendingLibraryRenames(['TRX Row', 'TRX Fallout'])).toEqual([]);
  });
});
