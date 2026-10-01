import { musclesForExercise } from '@/models/muscle-gaps';

interface LibraryExercise {
  name: string;
  muscles: readonly string[];
  equipment: string | null;
  mechanic: string | null;
  force: string | null;
  category: string;
}

const ignoredWords = new Set(['the', 'a', 'with', 'on', 'to', 'and', 'of']);
const words = (name: string) =>
  new Set(
    (name.toLowerCase().match(/[a-z]+/g) ?? []).filter(
      (w) => !ignoredWords.has(w),
    ),
  );
const nameKey = (name: string) => name.trim().toLowerCase();

/**
 * Library exercises to swap in for a lift, closest first. Candidates work the
 * same main muscle, are strength exercises rather than stretches, and keep
 * pushes with pushes and pulls with pulls where the library says which.
 *
 * Muscle tags alone rank a lunge level with a leg press variant, so the score
 * also weighs shared muscles, compound versus isolation, equipment, and words
 * the names share ("press", "curl", "pulldown").
 */
export function relatedExercises<T extends LibraryExercise>({
  name,
  library,
  limit = 10,
}: {
  name: string;
  library: readonly T[];
  limit?: number;
}): T[] {
  const byName = new Map(library.map((x) => [nameKey(x.name), x]));
  const known = byName.get(nameKey(name));
  const muscles = musclesForExercise(name, byName);
  const mainMuscle = muscles[0];
  if (!mainMuscle) {
    return [];
  }
  const targetWords = words(name);

  const score = (candidate: T) => {
    const shared = candidate.muscles.filter((m) => muscles.includes(m)).length;
    const all = new Set([...candidate.muscles, ...muscles]).size;
    const sharedWords = [...words(candidate.name)].filter((w) =>
      targetWords.has(w),
    ).length;
    return (
      2 * (shared / all) +
      (known?.mechanic && known.mechanic === candidate.mechanic ? 1 : 0) +
      (known && known.equipment === candidate.equipment ? 0.5 : 0) +
      1.5 * (sharedWords / Math.max(1, targetWords.size))
    );
  };

  return library
    .filter(
      (x) =>
        nameKey(x.name) !== nameKey(name) &&
        x.category === 'strength' &&
        x.muscles[0] === mainMuscle &&
        !(known?.force && x.force && x.force !== known.force),
    )
    .map((x) => ({ x, score: score(x) }))
    .sort((a, b) => b.score - a.score || a.x.name.localeCompare(b.x.name))
    .slice(0, limit)
    .map(({ x }) => x);
}
