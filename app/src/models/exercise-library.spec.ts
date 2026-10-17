import { describe, expect, it } from 'vitest';
import library from '../../assets/exercises.json';

const exercises = library.exercises;
const muscles = new Set([
  'abdominals',
  'abductors',
  'adductors',
  'biceps',
  'calves',
  'chest',
  'forearms',
  'glutes',
  'hamstrings',
  'lats',
  'lower back',
  'middle back',
  'neck',
  'quadriceps',
  'shoulders',
  'traps',
  'triceps',
]);

describe('bundled exercise library', () => {
  it('has unique names, which are the ids built-ins are added under', () => {
    const names = exercises.map((x) => x.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('only uses muscles the stats and filters know', () => {
    const unknown = exercises.flatMap((x) =>
      [...x.primaryMuscles, ...x.secondaryMuscles]
        .filter((m) => !muscles.has(m))
        .map((m) => `${x.name}: ${m}`),
    );
    expect(unknown).toEqual([]);
  });

  it('has a TRX set that search finds by "TRX"', () => {
    const trx = exercises.filter((x) => x.name.startsWith('TRX '));
    expect(trx.length).toBeGreaterThanOrEqual(20);
    expect(trx.every((x) => x.equipment === 'suspension trainer')).toBe(true);
    expect(trx.every((x) => x.primaryMuscles.length > 0)).toBe(true);
  });
});
