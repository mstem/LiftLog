import WeightFormat from '@/components/presentation/foundation/weight-format';
import { useAppTheme, spacing, font, rounding } from '@/hooks/useAppTheme';
import { Weight } from '@/models/weight';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';

export const personalRecordFlashDurationMs = 2000;

interface PersonalRecordFlashProps {
  weight: Weight | undefined;
  reps: number | undefined;
}

/**
 * A non-interactive trophy badge which pops in over a set when a personal
 * record is hit and fades back out. Taps pass straight through to the set
 * row underneath.
 */
export default function PersonalRecordFlash(props: PersonalRecordFlashProps) {
  const { colors } = useAppTheme();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: 250,
        easing: Easing.bezier(0.2, 0, 0, 1),
        useNativeDriver: true,
      }),
      Animated.delay(personalRecordFlashDurationMs - 250 - 400),
      Animated.timing(progress, {
        toValue: 0,
        duration: 400,
        easing: Easing.bezier(0.4, 0, 1, 1),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [progress]);

  return (
    <Animated.View
      testID="personal-record-flash"
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: progress,
        transform: [
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.5, 1],
            }),
          },
        ],
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[2],
          backgroundColor: colors.inverseSurface,
          borderRadius: rounding.roundedRectangleRadius,
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[1],
        }}
      >
        <Text style={{ ...font['text-base'] }}>🏆</Text>
        {props.weight ? (
          <WeightFormat
            weight={props.weight}
            fontSize="text-base"
            color="inverseOnSurface"
            fontWeight="bold"
          />
        ) : null}
        {props.reps !== undefined ? (
          <Text
            style={{
              ...font['text-base'],
              color: colors.inverseOnSurface,
              fontWeight: 'bold',
            }}
          >
            × {props.reps}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}
