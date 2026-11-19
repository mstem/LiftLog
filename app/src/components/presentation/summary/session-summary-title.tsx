import ItemTitle from '@/components/presentation/foundation/item-title';
import { SurfaceText } from '@/components/presentation/foundation/surface-text';
import { Session } from '@/models/session-models';
import { LocalDate } from '@js-joda/core';
import { View } from 'react-native';
import { useFormatDate } from '@/hooks/useFormatDate';
import { formatDuration, formatStartTime } from '@/utils/format-date';
import { useAppSelector } from '@/store';
import { getCalendars } from 'expo-localization';

/** The phone's 12/24 h setting; 24 h when it can't be read. */
function phoneUses24HourClock(): boolean {
  try {
    return getCalendars()[0]?.uses24hourClock ?? true;
  } catch {
    return true;
  }
}

interface SessionSummaryTitleProps {
  session: Session;
  isFilled?: boolean;
  showDuration?: boolean;
}
export default function SessionSummaryTitle({
  session,
  isFilled,
  showDuration,
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
  const start = showDuration ? session.workoutClockStart : undefined;
  return (
    <View
      style={{ flexShrink: 1, alignItems: 'flex-start', overflow: 'hidden' }}
      testID="session-summary-title"
    >
      <ItemTitle title={session.blueprint.name} />
      {isFilled ? (
        <SurfaceText font="text-sm">
          {formattedDate}
          {start
            ? ` · ${formatStartTime(start, locale, phoneUses24HourClock())}`
            : ''}
          {duration ? ` · ${formatDuration(duration, 'hours-mins')}` : ''}
        </SurfaceText>
      ) : undefined}
    </View>
  );
}
