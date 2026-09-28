import ItemTitle from '@/components/presentation/foundation/item-title';
import { SurfaceText } from '@/components/presentation/foundation/surface-text';
import { Session } from '@/models/session-models';
import { LocalDate } from '@js-joda/core';
import { View } from 'react-native';
import { useFormatDate, useFormatTime } from '@/hooks/useFormatDate';
import { formatDuration } from '@/utils/format-date';

interface SessionSummaryTitleProps {
  session: Session;
  isFilled?: boolean;
  showDuration?: boolean;
  showTime?: boolean;
}
export default function SessionSummaryTitle({
  session,
  isFilled,
  showDuration,
  showTime,
}: SessionSummaryTitleProps) {
  const formatDate = useFormatDate();
  const formatTime = useFormatTime();
  const formattedDate = formatDate(session.date, {
    year:
      session.date.year() !== LocalDate.now().year() ? 'numeric' : undefined,
    day: 'numeric',
    weekday: 'long',
    month: 'long',
  });
  const duration = showDuration ? session.duration : undefined;
  // The same exercise the duration is measured from, so the time and the length
  // of the workout always describe the same span.
  const startTime = showTime ? session.firstExercise?.earliestTime : undefined;
  return (
    <View
      style={{ flexShrink: 1, alignItems: 'flex-start', overflow: 'hidden' }}
      testID="session-summary-title"
    >
      <ItemTitle title={session.blueprint.name} />
      {isFilled ? (
        <SurfaceText font="text-sm">
          {formattedDate}
          {startTime ? ` · ${formatTime(startTime)}` : ''}
          {duration ? ` · ${formatDuration(duration, 'hours-mins')}` : ''}
        </SurfaceText>
      ) : undefined}
    </View>
  );
}
