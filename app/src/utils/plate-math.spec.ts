import { describe, it, expect } from 'vitest';
import BigNumber from 'bignumber.js';
import { Weight } from '@/models/weight';
import {
  formatPlateBreakdown,
  getPlateBreakdown,
  isBarbellExercise,
} from './plate-math';

const kg = (value: number) => new Weight(new BigNumber(value), 'kilograms');

describe('plate-math', () => {
  describe('isBarbellExercise', () => {
    it('matches barbell keywords case-insensitively', () => {
      expect(isBarbellExercise('Barbell Row')).toBe(true);
      expect(isBarbellExercise('Back Squat')).toBe(true);
      expect(isBarbellExercise('Bench Press')).toBe(true);
      expect(isBarbellExercise('DEADLIFT')).toBe(true);
    });

    it('excludes non-barbell variants even when a keyword matches', () => {
      expect(isBarbellExercise('Dumbbell Bench Press')).toBe(false);
      expect(isBarbellExercise('Leg Press')).toBe(false);
      expect(isBarbellExercise('Cable Row')).toBe(false);
      expect(isBarbellExercise('Smith Machine Squat')).toBe(false);
    });

    it('returns false for exercises with no barbell keyword', () => {
      expect(isBarbellExercise('Pull Up')).toBe(false);
      expect(isBarbellExercise('Lateral Raise')).toBe(false);
    });
  });

  describe('getPlateBreakdown', () => {
    it('subtracts a 20kg bar and splits the rest per side', () => {
      const breakdown = getPlateBreakdown(kg(100));
      expect(breakdown?.perSide).toEqual([
        { plate: new BigNumber(20), count: 2 },
      ]);
      expect(breakdown?.remainderPerSide.toNumber()).toBe(0);
    });

    it('greedily uses the largest plates first', () => {
      const breakdown = getPlateBreakdown(kg(85)); // 32.5 per side
      expect(formatPlateBreakdown(breakdown!)).toBe('20s + 10s + 2.5s');
    });

    it('reports a remainder when plates cannot represent the weight exactly', () => {
      const breakdown = getPlateBreakdown(kg(23)); // 1.5 per side
      expect(breakdown?.perSide).toEqual([]);
      expect(breakdown?.remainderPerSide.toNumber()).toBe(1.5);
    });

    it('returns undefined at or below the bar weight', () => {
      expect(getPlateBreakdown(kg(20))).toBeUndefined();
      expect(getPlateBreakdown(kg(15))).toBeUndefined();
    });

    it('returns undefined for pounds', () => {
      expect(getPlateBreakdown(new Weight(new BigNumber(225), 'pounds'))).toBeUndefined();
    });
  });

  describe('formatPlateBreakdown', () => {
    it('adds a trailing "s" to a lone plate', () => {
      const breakdown = getPlateBreakdown(kg(60)); // 20 per side
      expect(formatPlateBreakdown(breakdown!)).toBe('20s');
    });

    it('collapses repeated plates into a count and appends remainder', () => {
      const breakdown = getPlateBreakdown(kg(142.5)); // 61.25 per side
      expect(formatPlateBreakdown(breakdown!)).toBe('3×20 + 1.25');
    });
  });
});
