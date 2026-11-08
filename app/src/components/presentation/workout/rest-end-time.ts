import { Duration, OffsetDateTime } from '@js-joda/core';

/**
 * What the workout clock will read when the rest reaches `restLength`, with
 * seconds: m:ss under an hour, h:mm:ss after. The clock starts at
 * `clockStart`, so it matches a watch started at the same moment.
 */
export function restEndWorkoutClock(
  clockStart: OffsetDateTime,
  restStart: OffsetDateTime,
  restLength: Duration,
): string {
  const elapsedMillis = Duration.between(
    clockStart,
    restStart.plus(restLength),
  ).toMillis();
  // Rounded up to the second, as the countdown is, so the two agree.
  const totalSeconds = Math.max(0, Math.ceil(elapsedMillis / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return hours
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}
