import { Duration, OffsetDateTime } from '@js-joda/core';

/**
 * The time of day the rest reaches `restLength`, with seconds, in the app's
 * language (so 24-hour or am/pm as that locale writes it), or the phone's
 * own locale when no language is set.
 */
export function restEndTimeOfDay(
  restStart: OffsetDateTime,
  restLength: Duration,
  locale: string | undefined,
): string {
  const endMillis = restStart.plus(restLength).toInstant().toEpochMilli();
  // Rounded up to the second, as the countdown is, so the two agree.
  return new Date(Math.ceil(endMillis / 1000) * 1000).toLocaleTimeString(
    locale,
    { hour: 'numeric', minute: '2-digit', second: '2-digit' },
  );
}
