import { AccordionItem } from '@/components/presentation/foundation/accordion-item';
import { SurfaceText } from '@/components/presentation/foundation/surface-text';
import { spacing, useAppTheme } from '@/hooks/useAppTheme';
import { REHAB_GROUP } from '@/models/injury/rehab';
import { useTranslate } from '@tolgee/react';
import { ReactNode, useEffect, useState } from 'react';
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
  /** Opens the block whenever the next set to do is inside it. */
  containsNext?: boolean;
  children: ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(!!props.containsNext);
  useEffect(() => {
    if (props.containsNext) {
      setIsExpanded(true);
    }
  }, [props.containsNext]);
  const { colors } = useAppTheme();
  const { t } = useTranslate();
  const label =
    props.name === REHAB_GROUP ? t('injury.rehab.group') : props.name;

  return (
    <View>
      <TouchableRipple
        onPress={() => setIsExpanded((x) => !x)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        accessibilityLabel={label}
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
            {label}
          </SurfaceText>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing[2],
            }}
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
