import { DayOfWeek, Duration, LocalDate, OffsetDateTime } from '@js-joda/core';
import { match } from 'ts-pattern';

export function getDateOnDay(dayOfWeek: DayOfWeek) {
  // Super gross and hacky, but then we get i18n formatting for free
  const constantSundayDay = LocalDate.of(2025, 5, 4);
  const dateWithSpecifiedDayOfWeek = constantSundayDay.plusDays(
    dayOfWeek.value(),
  );
  return dateWithSpecifiedDayOfWeek;
}

export function formatDuration(
  duration: Duration,
  truncateTo: 'mins' | 'none' | 'hours-mins' = 'none',
) {
  const str = match({ duration, truncateTo })
    .with(
      { truncateTo: 'mins' },
      () => `${Math.floor(duration.toMinutes())} mins`,
    )
    .when(
      ({ duration, truncateTo }) =>
        duration.toHours() >= 1 && truncateTo === 'hours-mins',
      () =>
        `${duration.toHours()} hrs ${Math.floor(duration.toMinutes() - 60 * duration.toHours())} mins`,
    )
    .when(
      ({ duration }) => duration.toHours() >= 1,
      () => `${duration.toHours()} hrs`,
    )
    .when(
      ({ duration }) => duration.toMinutes() >= 1,
      () => `${duration.toMinutes()} mins`,
    )
    .otherwise(() => `${duration.toMillis() / 1000} secs`);

  return str;
}

/**
 * The time of day a workout started, as the clock read where it was done. The
 * offset is dropped rather than converted, so a workout done abroad keeps its
 * local time.
 */
export function formatStartTime(
  start: OffsetDateTime,
  locale: string | undefined,
  uses24HourClock: boolean,
): string {
  return new Date(2000, 0, 1, start.hour(), start.minute()).toLocaleTimeString(
    locale,
    {
      hour: uses24HourClock ? '2-digit' : 'numeric',
      minute: '2-digit',
      hourCycle: uses24HourClock ? 'h23' : 'h12',
    },
  );
}

/**
 * Takes a string formatted by the csharp format string: @"d\.hh\:mm\:ss\:FFF"
 * and returns a js joda duration
 * Days and milliseconds are optional (e.g., "02:30:45" or "1.02:30:45:123")
 */
export function parseDuration(val: string): Duration {
  // Regex with optional days and milliseconds
  const regex = /^(?:(\d+)\.)?(\d{2}):(\d{2}):(\d{2})(?::(\d{3}))?$/;
  const matchResult = val.match(regex);

  if (!matchResult) {
    throw new Error(`Invalid duration format: ${val}`);
  }

  const [, daysStr, hoursStr, minutesStr, secondsStr, millisStr] = matchResult;

  const days = daysStr ? Number(daysStr) : 0;
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  const seconds = Number(secondsStr);
  const millis = millisStr ? Number(millisStr) : 0;

  return Duration.ofDays(days)
    .plusHours(hours)
    .plusMinutes(minutes)
    .plusSeconds(seconds)
    .plusMillis(millis);
}
