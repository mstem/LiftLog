import { describe, expect, it } from 'vitest';
import { LocalDateTime, YearMonth, ZoneId, ZonedDateTime } from '@js-joda/core';
import {
  monthlyReportDeliveryTime,
  monthlyReportUrl,
} from '@/models/monthly-report-schedule';

const at = (iso: string): ZonedDateTime =>
  LocalDateTime.parse(iso).atZone(ZoneId.systemDefault());

describe('monthlyReportDeliveryTime', () => {
  it('is 09:00 local time on the 1st of the next month', () => {
    const when = monthlyReportDeliveryTime(
      YearMonth.of(2026, 9),
      at('2026-09-17T12:00'),
    )!;

    expect([when.getFullYear(), when.getMonth(), when.getDate()]).toEqual([
      2026, 9, 1,
    ]);
    expect([when.getHours(), when.getMinutes()]).toEqual([9, 0]);
  });

  it('rolls December over into January', () => {
    const when = monthlyReportDeliveryTime(
      YearMonth.of(2026, 12),
      at('2026-12-31T12:00'),
    )!;

    expect([when.getFullYear(), when.getMonth(), when.getDate()]).toEqual([
      2027, 0, 1,
    ]);
  });

  it('reads 09:00 in the zone of the time it is given', () => {
    const zone = ZoneId.of('UTC+14');
    const now = LocalDateTime.parse('2026-10-01T08:30').atZone(zone);

    const when = monthlyReportDeliveryTime(YearMonth.of(2026, 9), now)!;

    expect(when.getTime()).toBe(
      LocalDateTime.parse('2026-10-01T09:00')
        .atZone(zone)
        .toInstant()
        .toEpochMilli(),
    );
  });

  it('is undefined for a month whose report day has passed', () => {
    expect(
      monthlyReportDeliveryTime(YearMonth.of(2026, 9), at('2026-10-01T09:00')),
    ).toBeUndefined();
  });

  it('is still 09:00 on the 1st earlier that morning', () => {
    const when = monthlyReportDeliveryTime(
      YearMonth.of(2026, 9),
      at('2026-10-01T07:00'),
    )!;

    expect([when.getMonth(), when.getDate(), when.getHours()]).toEqual([
      9, 1, 9,
    ]);
  });
});

describe('monthlyReportUrl', () => {
  it('opens the report for that month', () => {
    expect(monthlyReportUrl(YearMonth.of(2026, 9))).toBe(
      '/stats/monthly-report?month=2026-09',
    );
  });
});
