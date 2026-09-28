import { LocalDate, OffsetDateTime } from '@js-joda/core';
import { useAppSelector } from '@/store';

export function useFormatDate(): (
  date: LocalDate,
  opts: Intl.DateTimeFormatOptions,
) => string {
  const locale = useAppSelector((x) => x.settings.preferredLanguage);
  return (date, opts) =>
    new Date(
      date.year(),
      date.month().ordinal(),
      date.dayOfMonth(),
    ).toLocaleString(locale, opts);
}

export function useFormatTime(): (time: OffsetDateTime) => string {
  const locale = useAppSelector((x) => x.settings.preferredLanguage);
  // Formatted from the offset the set was recorded in, so a workout reads back at
  // the wall-clock time it was done at rather than shifting with the current zone.
  return (time) =>
    new Date(
      time.year(),
      time.month().ordinal(),
      time.dayOfMonth(),
      time.hour(),
      time.minute(),
    ).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}
