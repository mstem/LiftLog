import { describe, expect, it } from 'vitest';
import { Duration, OffsetDateTime } from '@js-joda/core';
import { restEndWorkoutClock } from '@/components/presentation/workout/rest-end-time';

const clockStart = OffsetDateTime.parse('2026-10-17T18:00:00Z');
const at = (iso: string) => OffsetDateTime.parse(iso);

describe('restEndWorkoutClock', () => {
  it('gives the workout clock reading when the rest ends, with seconds', () => {
    expect(
      restEndWorkoutClock(
        clockStart,
        at('2026-10-17T18:40:05Z'),
        Duration.ofSeconds(150),
      ),
    ).toBe('42:35');
  });

  it('pads seconds and shows minutes from zero', () => {
    expect(
      restEndWorkoutClock(
        clockStart,
        at('2026-10-17T18:00:00Z'),
        Duration.ofSeconds(65),
      ),
    ).toBe('1:05');
  });

  it('adds hours after an hour', () => {
    expect(
      restEndWorkoutClock(
        clockStart,
        at('2026-10-17T19:02:00Z'),
        Duration.ofSeconds(90),
      ),
    ).toBe('1:03:30');
  });

  it('rounds part seconds up, as the countdown does', () => {
    expect(
      restEndWorkoutClock(
        clockStart,
        at('2026-10-17T18:10:00.200Z'),
        Duration.ofSeconds(60),
      ),
    ).toBe('11:01');
  });
});
