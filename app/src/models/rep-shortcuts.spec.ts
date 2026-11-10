import { describe, expect, it } from 'vitest';
import { repShortcuts, repsBefore } from '@/models/rep-shortcuts';

describe('repShortcuts', () => {
  it('centers on the reps done in an earlier set', () => {
    expect(repShortcuts({ repsAbove: 7, repTarget: 10 })).toEqual([
      2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  it('centers on the target when no earlier set is done', () => {
    expect(repShortcuts({ repsAbove: undefined, repTarget: 10 })).toEqual([
      5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ]);
  });

  it('keeps 11 buttons near 0 by shifting the row up', () => {
    expect(repShortcuts({ repsAbove: 2, repTarget: 10 })).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });
});

describe('repsBefore', () => {
  const done = (reps: number) => ({ set: { repsCompleted: reps } });
  const open = { set: undefined };

  it('takes the set directly above when it is done', () => {
    expect(repsBefore([done(8), done(6), open], {}, 2)).toBe(6);
  });

  it('skips sets above that are not done', () => {
    expect(repsBefore([done(6), open, open], {}, 2)).toBe(6);
  });

  it('counts reps typed into a set that is not ticked', () => {
    expect(repsBefore([done(6), open, open], { 1: 9 }, 2)).toBe(9);
  });

  it('is undefined for the first set', () => {
    expect(repsBefore([open, open], {}, 0)).toBeUndefined();
  });
});
