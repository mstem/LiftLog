import { describe, expect, it } from 'vitest';
import { Weight } from '@/models/weight';
import { weightIncreaseSinceLastTime } from '@/components/presentation/workout/weighted/weight-increase';

const kg = (value: number) => new Weight(value, 'kilograms');

describe('weightIncreaseSinceLastTime', () => {
  it('is the gain over last time when the weight goes up', () => {
    expect(
      weightIncreaseSinceLastTime({
        saved: kg(65),
        before: kg(60),
        lastTime: kg(60),
      }),
    ).toEqual(kg(5));
  });

  it('counts from last time, not from the value being replaced', () => {
    // 60 last time, already nudged to 62.5 this session, now 70: +10 overall
    expect(
      weightIncreaseSinceLastTime({
        saved: kg(70),
        before: kg(62.5),
        lastTime: kg(60),
      }),
    ).toEqual(kg(10));
  });

  it('stays quiet when the edit lowers the weight, even if still above last time', () => {
    expect(
      weightIncreaseSinceLastTime({
        saved: kg(62.5),
        before: kg(65),
        lastTime: kg(60),
      }),
    ).toBeUndefined();
  });

  it('stays quiet at or below last time', () => {
    expect(
      weightIncreaseSinceLastTime({
        saved: kg(60),
        before: kg(55),
        lastTime: kg(60),
      }),
    ).toBeUndefined();
  });

  it('stays quiet with no previous workout to beat', () => {
    expect(
      weightIncreaseSinceLastTime({
        saved: kg(60),
        before: kg(0),
        lastTime: undefined,
      }),
    ).toBeUndefined();
  });

  it('reports the gain in the unit just saved', () => {
    const gain = weightIncreaseSinceLastTime({
      saved: new Weight(135, 'pounds'),
      before: new Weight(130, 'pounds'),
      lastTime: kg(60),
    });

    expect(gain?.unit).toBe('pounds');
    expect(gain!.value.toNumber()).toBeCloseTo(2.72, 1);
  });
});
