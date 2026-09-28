import { describe, it, expect } from 'vitest';
import { withOpacity } from '@/utils/color';

describe('withOpacity', () => {
  it('converts a six digit hex', () => {
    expect(withOpacity('#2f80ed', 0.12)).toBe('rgba(47, 128, 237, 0.12)');
  });

  it('expands a three digit hex', () => {
    expect(withOpacity('#fff', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
  });

  it('leaves a colour it cannot parse alone', () => {
    expect(withOpacity('rgba(0, 0, 0, 0.4)', 0.12)).toBe('rgba(0, 0, 0, 0.4)');
  });
});
