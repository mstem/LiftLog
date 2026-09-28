import { describe, expect, it } from 'vitest';
import { Duration, OffsetDateTime, ZoneId } from '@js-joda/core';
import { restEndTimeOfDay } from '@/components/presentation/workout/rest-end-time';

// The clock face is in the phone's own time zone, so build the start there.
const restStart = OffsetDateTime.parse('2026-09-28T18:50:00Z')
  .atZoneSameInstant(ZoneId.SYSTEM)
  .toOffsetDateTime();
const expected = (iso: string, locale: string) =>
  new Date(iso).toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });

describe('restEndTimeOfDay', () => {
  it('adds the rest to the time it started', () => {
    expect(restEndTimeOfDay(restStart, Duration.ofSeconds(150), 'en-GB')).toBe(
      expected('2026-09-28T18:52:30Z', 'en-GB'),
    );
  });

  it('writes the time the way the app language does', () => {
    const us = restEndTimeOfDay(restStart, Duration.ofSeconds(150), 'en-US');

    expect(us).toBe(expected('2026-09-28T18:52:30Z', 'en-US'));
    expect(us).toMatch(/[AP]M/);
  });

  it('rounds part seconds up, as the countdown does', () => {
    expect(
      restEndTimeOfDay(
        restStart.plusNanos(200_000_000),
        Duration.ofSeconds(60),
        'en-GB',
      ),
    ).toBe(expected('2026-09-28T18:51:01Z', 'en-GB'));
  });
});
