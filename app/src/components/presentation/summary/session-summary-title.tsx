import ItemTitle from '@/components/presentation/foundation/item-title';
import { SurfaceText } from '@/components/presentation/foundation/surface-text';
import { Session } from '@/models/session-models';
import { LocalDate } from '@js-joda/core';
import { View } from 'react-native';
import { useFormatDate } from '@/hooks/useFormatDate';
import {
  formatDuration,
  formatStartTime,
  startTimeOnDay,
} from '@/utils/format-date';
import { useAppSelector } from '@/store';

interface SessionSummaryTitleProps {
  session: Session;
  isFilled?: boolean;
  showDuration?: boolean;
  /** Shows the start time, on a 24 h clock unless this says otherwise. */
  showStartTime?: boolean;
  uses24HourClock?: boolean;
}
export default function SessionSummaryTitle({
  session,
  isFilled,
  showDuration,
  showStartTime,
  uses24HourClock = true,
}: SessionSummaryTitleProps) {
  const formatDate = useFormatDate();
  const formattedDate = formatDate(session.date, {
    year:
      session.date.year() !== LocalDate.now().year() ? 'numeric' : undefined,
    day: 'numeric',
    weekday: 'long',
    month: 'long',
  });
  const locale = useAppSelector((x) => x.settings.preferredLanguage);
  const duration = showDuration ? session.duration : undefined;
  const start = showStartTime
    ? startTimeOnDay(session.workoutClockStart, session.date)
    : undefined;
  return (
    <View
      style={{ flexShrink: 1, alignItems: 'flex-start', overflow: 'hidden' }}
      testID="session-summary-title"
    >
      <ItemTitle title={session.blueprint.name} />
      {isFilled ? (
        <SurfaceText font="text-sm">
          {formattedDate}
          {start ? ` · ${formatStartTime(start, locale, uses24HourClock)}` : ''}
          {duration ? ` · ${formatDuration(duration, 'hours-mins')}` : ''}
        </SurfaceText>
      ) : undefined}
    </View>
  );
}
