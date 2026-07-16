import { AccordionItem } from '@/components/presentation/foundation/accordion-item';
import { SurfaceText } from '@/components/presentation/foundation/surface-text';
import { spacing, useAppTheme } from '@/hooks/useAppTheme';
import { ReactNode, useState } from 'react';
import { View } from 'react-native';
import { Icon } from 'react-native-paper';
import TouchableRipple from '@/components/presentation/foundation/gesture-wrappers/touchable-ripple';

/**
 * A named, collapsible run of exercises within a session - e.g. a mobility
 * block bolted onto the front of a workout. Collapsed by default so the block
 * stays out of the way of the exercises the session is actually about.
 */
export default function ExerciseGroupSection(props: {
  name: string;
  exerciseCount: number;
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
        testID={`exercise-group-toggle-${props.name}`}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.pageHorizontalMargin,
            paddingVertical: spacing[3],
            gap: spacing[3],
          }}
        >
          <SurfaceText font="text-base" weight="bold" style={{ flexShrink: 1 }}>
            {props.name}
          </SurfaceText>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}
          >
            <SurfaceText font="text-sm" color="onSurfaceVariant">
              {props.exerciseCount}
            </SurfaceText>
            <Icon
              source={isExpanded ? 'expandCircleUp' : 'expandCircleDown'}
              size={24}
              color={colors.onSurfaceVariant}
            />
          </View>
        </View>
      </TouchableRipple>
      <AccordionItem isExpanded={isExpanded}>{props.children}</AccordionItem>
    </View>
  );
}
