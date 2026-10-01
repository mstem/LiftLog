import { describe, expect, it } from 'vitest';
import { relatedExercises } from '@/models/related-exercises';

const entry = (
  name: string,
  muscles: string[],
  equipment: string | null,
  extra: Partial<{ mechanic: string; force: string; category: string }> = {},
) => ({
  name,
  muscles,
  equipment,
  mechanic: extra.mechanic ?? 'compound',
  force: extra.force ?? 'push',
  category: extra.category ?? 'strength',
});

const legs = ['quadriceps', 'calves', 'glutes', 'hamstrings'];
const library = [
  entry('Leg Press', legs, 'machine'),
  entry('Barbell Walking Lunge', legs, 'barbell'),
  entry('Narrow Stance Leg Press', legs, 'machine'),
  entry('Smith Machine Leg Press', legs, 'machine'),
  entry('Chair Squat', legs, 'machine'),
  entry('Leg Extensions', ['quadriceps'], 'machine', { mechanic: 'isolation' }),
  entry('Quad Stretch', ['quadriceps'], null, { category: 'stretching' }),
  entry('Lying Leg Curls', ['hamstrings'], 'machine', { force: 'pull' }),
  entry('Hamstring Curl Stretch', ['hamstrings'], null, {
    category: 'stretching',
    force: 'pull',
  }),
  entry('Bench Press', ['chest', 'triceps'], 'barbell'),
];

const names = (name: string, limit?: number) =>
  relatedExercises({ name, library, limit }).map((x) => x.name);

describe('relatedExercises', () => {
  it('ranks the closest variants of the same lift first', () => {
    expect(names('Leg Press', 3)).toEqual([
      'Narrow Stance Leg Press',
      'Smith Machine Leg Press',
      'Chair Squat',
    ]);
  });

  it('puts a lunge below the machine variants with the same muscles', () => {
    const ranked = names('Leg Press');
    expect(ranked.indexOf('Barbell Walking Lunge')).toBeGreaterThan(
      ranked.indexOf('Chair Squat'),
    );
  });

  it('keeps to the same main muscle and leaves the lift itself out', () => {
    const ranked = names('Leg Press');
    expect(ranked).not.toContain('Leg Press');
    expect(ranked).not.toContain('Bench Press');
    expect(ranked).not.toContain('Lying Leg Curls');
  });

  it('leaves out stretches', () => {
    expect(names('Leg Extensions')).not.toContain('Quad Stretch');
    expect(names('Lying Leg Curls')).not.toContain('Hamstring Curl Stretch');
  });

  it('keeps pushes with pushes and pulls with pulls', () => {
    expect(names('Leg Extensions')).not.toContain('Lying Leg Curls');
  });

  it('finds matches for names the library lacks, through the muscle map', () => {
    // "Bench Press (Barbell)" is a Hevy-import name, mapped to chest first
    expect(names('Bench Press (Barbell)')).toContain('Bench Press');
  });

  it('matches names regardless of case and spacing', () => {
    expect(names(' leg press', 1)).toEqual(['Narrow Stance Leg Press']);
  });

  it('returns nothing for an exercise with no known muscles', () => {
    expect(names('Mystery Move')).toEqual([]);
  });
});
