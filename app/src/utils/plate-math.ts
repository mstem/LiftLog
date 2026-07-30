import { Weight } from '@/models/weight';
import BigNumber from 'bignumber.js';

// Standard Olympic bar and kilogram plate denominations
const BAR_WEIGHT_KG = new BigNumber(20);
const PLATES_KG = [20, 15, 10, 5, 2.5].map((x) => new BigNumber(x));

// Names that strongly suggest a barbell is used
const BARBELL_KEYWORDS = [
  'barbell',
  'squat',
  'bench',
  'deadlift',
  'press',
  'row',
  'curl',
  'lunge',
  'clean',
  'snatch',
  'thrust',
  'good morning',
  'romanian',
  'rdl',
  'ohp',
  'pendlay',
];

// Names that use these are not loaded on a standard barbell, even if they
// match a keyword above (e.g. "Dumbbell Bench Press", "Leg Press")
const NON_BARBELL_KEYWORDS = [
  'dumbbell',
  'machine',
  'cable',
  'band',
  'kettlebell',
  'bodyweight',
  'smith',
  'leg press',
  'leg curl',
];

export function isBarbellExercise(name: string): boolean {
  const lower = name.toLowerCase();
  if (NON_BARBELL_KEYWORDS.some((k) => lower.includes(k))) {
    return false;
  }
  return BARBELL_KEYWORDS.some((k) => lower.includes(k));
}

export interface PlateGroup {
  plate: BigNumber;
  count: number;
}

export interface PlateBreakdown {
  perSide: PlateGroup[];
  // Weight per side that could not be represented by available plates
  remainderPerSide: BigNumber;
}

/**
 * Breaks a total barbell weight down into the plates loaded on each side,
 * assuming a 20kg bar. Returns undefined when a plate breakdown does not make
 * sense (weight at or below the bar, or a non-kilogram unit).
 */
export function getPlateBreakdown(weight: Weight): PlateBreakdown | undefined {
  // Plate denominations here are in kilograms, so only show for kg (nil
  // coalesces to whatever unit is in use, which we treat as kg here).
  if (weight.unit === 'pounds') {
    return undefined;
  }

  const perSideTotal = weight.value.minus(BAR_WEIGHT_KG).dividedBy(2);
  if (perSideTotal.isLessThanOrEqualTo(0)) {
    return undefined;
  }

  const perSide: PlateGroup[] = [];
  let remaining = perSideTotal;
  for (const plate of PLATES_KG) {
    const count = remaining.dividedToIntegerBy(plate).toNumber();
    if (count > 0) {
      perSide.push({ plate, count });
      remaining = remaining.minus(plate.multipliedBy(count));
    }
  }

  return { perSide, remainderPerSide: remaining };
}

/**
 * Formats a plate breakdown into a compact per-side string, e.g. "2×20 + 5s".
 * A lone plate gets a trailing "s" (e.g. "20s") as a reminder it's plates per
 * side; multiples already read as plural via the count (e.g. "2×20").
 * Returns undefined when there are no plates to show.
 */
export function formatPlateBreakdown(
  breakdown: PlateBreakdown,
): string | undefined {
  const parts = breakdown.perSide.map(({ plate, count }) =>
    count > 1 ? `${count}×${plate.toString()}` : `${plate.toString()}s`,
  );
  if (breakdown.remainderPerSide.isGreaterThan(0)) {
    parts.push(breakdown.remainderPerSide.toString());
  }
  return parts.length ? parts.join(' + ') : undefined;
}
