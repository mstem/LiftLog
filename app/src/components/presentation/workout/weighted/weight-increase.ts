import { Weight } from '@/models/weight';

/**
 * How much heavier a set just saved is than the same set last workout, or
 * undefined when there is nothing to celebrate: no previous workout, not above
 * it, or an edit that lowered the weight.
 */
export function weightIncreaseSinceLastTime({
  saved,
  before,
  lastTime,
}: {
  saved: Weight;
  before: Weight;
  lastTime: Weight | undefined;
}): Weight | undefined {
  if (!lastTime || !saved.isGreaterThan(before)) {
    return undefined;
  }
  if (!saved.isGreaterThan(lastTime)) {
    return undefined;
  }
  return saved.minus(lastTime);
}
