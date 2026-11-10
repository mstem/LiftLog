import { describe, expect, it } from 'vitest';
import {
  repShortcutCenter,
  repShortcuts,
  repsBefore,
} from '@/models/rep-shortcuts';

describe('repShortcuts', () => {
  it('runs five either side of the center', () => {
    expect(repShortcuts(7)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('keeps 11 buttons near 0 by shifting the row up', () => {
    expect(repShortcuts(2)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe('repShortcutCenter', () => {
  it("uses the set's own reps when it has some", () => {
    expect(repShortcutCenter({ ownReps: 3, repsAbove: 12, cellReps: 10 })).toBe(
      3,
    );
  });

  it('follows the earlier set ticked today', () => {
    expect(
      repShortcutCenter({ ownReps: undefined, repsAbove: 7, cellReps: 10 }),
    ).toBe(7);
  });

  it('falls back to the number the cell shows', () => {
    expect(
      repShortcutCenter({
        ownReps: undefined,
        repsAbove: undefined,
        cellReps: 4,
      }),
    ).toBe(4);
  });
});

describe('repsBefore', () => {
  const done = (reps: number) => ({ set: { repsCompleted: reps } });
  const open = { set: undefined };

  it('takes the set directly above when it is ticked', () => {
    expect(repsBefore([done(8), done(6), open], 2)).toBe(6);
  });

  it('skips sets above that are not ticked', () => {
    expect(repsBefore([done(6), open, open], 2)).toBe(6);
  });

  it('is undefined for the first set', () => {
    expect(repsBefore([open, open], 0)).toBeUndefined();
  });
});
