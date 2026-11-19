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
 * The start to show for a workout done on `date`. A workout logged later from
 * History stamps its sets with the time they were typed in, so a start on
 * another day says nothing about when the workout happened.
 */
export function startTimeOnDay(
  start: OffsetDateTime | undefined,
  date: LocalDate,
): OffsetDateTime | undefined {
  return start && start.toLocalDate().equals(date) ? start : undefined;
}

/**
 * The time of day a workout started, as the clock read where it was done. It
 * drops the offset rather than converting it, so a workout done abroad keeps
 * its local time.
 */
export function formatStartTime(
  start: OffsetDateTime,
  locale: string | undefined,
  uses24HourClock: boolean,
): string {
  if (uses24HourClock) {
    // Some Intl engines turn hour12: false into 24:05, so this builds HH:mm itself.
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(start.hour())}:${pad(start.minute())}`;
  }
  return new Date(2000, 0, 1, start.hour(), start.minute()).toLocaleTimeString(
    locale,
    { hour: 'numeric', minute: '2-digit', hour12: true },
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
