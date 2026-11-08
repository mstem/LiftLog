import { describe, expect, it } from 'vitest';
import { loggedExerciseNames, searchSwapOptions } from './swap-search';

const lift = (name: string, isStarted: boolean) => ({
  isStarted,
  blueprint: { name },
});

describe('loggedExerciseNames', () => {
  it('counts only lifts that had a set done, not planned lifts that were skipped', () => {
    const names = loggedExerciseNames([
      {
        recordedExercises: [
          lift('Barbell Bench Press', true),
          lift('Bench Dips', false),
        ],
      },
    ]);
    expect([...names]).toEqual(['barbell bench press']);
  });
});

describe('searchSwapOptions', () => {
  const library = [
    { name: 'Barbell Bench Press' },
    { name: 'Dumbbell Bench Press' },
  ];

  it('never offers the lift being swapped out', () => {
    const names = searchSwapOptions({
      search: 'bench press',
      library,
      logged: new Set(['barbell bench press']),
      exclude: 'Barbell Bench Press',
      limit: 10,
    }).map((x) => x.name);
    expect(names).toEqual(['Dumbbell Bench Press']);
  });

  it('puts a logged lift above an unlogged one that matches as well', () => {
    const names = searchSwapOptions({
      search: 'bench press',
      library,
      logged: new Set(['dumbbell bench press']),
      exclude: undefined,
      limit: 10,
    }).map((x) => x.name);
    expect(names[0]).toBe('Dumbbell Bench Press');
  });
});
