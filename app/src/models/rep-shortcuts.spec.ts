import { describe, expect, it } from 'vitest';
import { repShortcuts } from '@/models/rep-shortcuts';

describe('repShortcuts', () => {
  it('centers on the reps done in the set above', () => {
    expect(repShortcuts({ repsAbove: 7, repTarget: 10 })).toEqual([
      2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  it('centers on the target for the first set, or when the set above is not done', () => {
    expect(repShortcuts({ repsAbove: undefined, repTarget: 10 })).toEqual([
      5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ]);
  });

  it('stops at 0 at the low end', () => {
    expect(repShortcuts({ repsAbove: 2, repTarget: 10 })).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);
  });
});
