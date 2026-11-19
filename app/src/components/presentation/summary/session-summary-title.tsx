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
import { useCalendars } from 'expo-localization';

/** The phone's 12/24 h setting; 24 h when it can't be read. */
function usePhone24HourClock(): boolean {
  try {
    return useCalendars()[0]?.uses24hourClock ?? true;
  } catch {
    return true;
  }
}

interface SessionSummaryTitleProps {
  session: Session;
  isFilled?: boolean;
  showDuration?: boolean;
  showStartTime?: boolean;
}
export default function SessionSummaryTitle({
  session,
  isFilled,
  showDuration,
  showStartTime,
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
  const uses24HourClock = usePhone24HourClock();
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
