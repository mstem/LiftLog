import { LocalTime, YearMonth, ZonedDateTime } from '@js-joda/core';

const deliveryTime = LocalTime.of(9, 0);

export const monthlyReportUrl = (month: YearMonth) =>
  `/stats/monthly-report?month=${month.toString()}`;

/**
 * When the report for `month` goes out: 09:00 on the 1st of the next month,
 * or undefined once that time has passed.
 */
export function monthlyReportDeliveryTime(
  month: YearMonth,
  now: ZonedDateTime,
): Date | undefined {
  const at = month
    .plusMonths(1)
    .atDay(1)
    .atTime(deliveryTime)
    .atZone(now.zone());
  if (!now.isBefore(at)) {
    return undefined;
  }
  return new Date(at.toInstant().toEpochMilli());
}
