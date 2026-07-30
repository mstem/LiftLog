import ExerciseSummary from '@/components/presentation/summary/exercise-summary';
import { spacing, useAppTheme } from '@/hooks/useAppTheme';
import { Session } from '@/models/session-models';
import { View } from 'react-native';
import { groupExercises } from '@/components/smart/group-exercises';
import { AccordionItem } from '@/components/presentation/foundation/accordion-item';
import { SurfaceText } from '@/components/presentation/foundation/surface-text';
import TouchableRipple from '@/components/presentation/foundation/gesture-wrappers/touchable-ripple';
import { Icon } from 'react-native-paper';
import { ReactNode, useState } from 'react';

interface SessionSummaryProps {
  session: Session;
  isFilled?: boolean;
  showWeight?: boolean;
  /**
   * When set, contiguous exercises sharing a `group` (e.g. a Mobility block)
   * are folded into a collapsed, tappable header instead of listing every
   * exercise inline - keeps the workout card from being dominated by warmups.
   */
  collapseGroups?: boolean;
}
export default function SessionSummary({
  session,
  isFilled,
  showWeight,
  collapseGroups,
}: SessionSummaryProps) {
  const visibleExercises = session.recordedExercises.filter(
    (x) => x.isStarted || !isFilled,
  );

  const renderExercise = (exercise: (typeof visibleExercises)[number], key: number) => (
    <ExerciseSummary
      key={key}
      exercise={exercise}
      isFilled={!!isFilled}
      showName={true}
      showWeight={!!showWeight}
      showDate={false}
    />
  );

  return (
    <View style={{ gap: spacing[2], flex: 1 }} testID="session-summary">
      {collapseGroups
        ? groupExercises(visibleExercises).map((segment) =>
            segment.group === undefined ? (
              segment.entries.map(({ exercise, index }) =>
                renderExercise(exercise, index),
              )
            ) : (
              <SummaryGroup
                key={segment.key}
                name={segment.group}
                count={segment.entries.length}
              >
                {segment.entries.map(({ exercise, index }) =>
                  renderExercise(exercise, index),
                )}
              </SummaryGroup>
            ),
          )
        : visibleExercises.map((ex, index) => renderExercise(ex, index))}
    </View>
  );
}

/**
 * Compact, card-aligned collapsible header for a named group of exercises
 * within a session summary. Mirrors the in-workout ExerciseGroupSection but
 * without the full-page horizontal padding so it lines up with the card rows.
 */
function SummaryGroup(props: {
  name: string;
  count: number;
  children: ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { colors } = useAppTheme();
  return (
    <View>
      <TouchableRipple
        onPress={() => setIsExpanded((x) => !x)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        accessibilityLabel={props.name}
        testID={`summary-group-toggle-${props.name}`}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: spacing[1],
            gap: spacing[2],
          }}
        >
          <SurfaceText style={{ flexShrink: 1 }}>{props.name}</SurfaceText>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing[2],
            }}
          >
            <SurfaceText font="text-sm" color="onSurfaceVariant">
              {props.count}
            </SurfaceText>
            <Icon
              source={isExpanded ? 'expandCircleUp' : 'expandCircleDown'}
              size={20}
              color={colors.onSurfaceVariant}
            />
          </View>
        </View>
      </TouchableRipple>
      <AccordionItem isExpanded={isExpanded}>
        <View style={{ gap: spacing[2], paddingTop: spacing[2] }}>
          {props.children}
        </View>
      </AccordionItem>
    </View>
  );
}
