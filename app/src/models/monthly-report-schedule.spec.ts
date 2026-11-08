import { describe, expect, it } from 'vitest';
import { LocalDate, YearMonth } from '@js-joda/core';
import {
  monthlyReportDeliveryTime,
  monthlyReportUrl,
} from '@/models/monthly-report-schedule';

describe('monthlyReportDeliveryTime', () => {
  it('is 09:00 local time on the 1st of the next month', () => {
    const at = monthlyReportDeliveryTime(
      YearMonth.of(2026, 9),
      LocalDate.of(2026, 9, 17),
    )!;

    expect([at.getFullYear(), at.getMonth(), at.getDate()]).toEqual([
      2026, 9, 1,
    ]);
    expect([at.getHours(), at.getMinutes()]).toEqual([9, 0]);
  });

  it('rolls December over into January', () => {
    const at = monthlyReportDeliveryTime(
      YearMonth.of(2026, 12),
      LocalDate.of(2026, 12, 31),
    )!;

    expect([at.getFullYear(), at.getMonth(), at.getDate()]).toEqual([
      2027, 0, 1,
    ]);
  });

  it('is undefined for a month whose report day has come', () => {
    expect(
      monthlyReportDeliveryTime(
        YearMonth.of(2026, 9),
        LocalDate.of(2026, 10, 1),
      ),
    ).toBeUndefined();
  });
});

describe('monthlyReportUrl', () => {
  it('opens the report for that month', () => {
    expect(monthlyReportUrl(YearMonth.of(2026, 9))).toBe(
      '/stats/monthly-report?month=2026-09',
    );
  });
});
