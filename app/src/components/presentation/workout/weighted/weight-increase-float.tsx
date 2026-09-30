import WeightFormat from '@/components/presentation/foundation/weight-format';
import { Weight } from '@/models/weight';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { useAppTheme, font } from '@/hooks/useAppTheme';

export const weightIncreaseFloatDurationMs = 1500;

/**
 * "+5 kg" that rises from a set towards the top of the screen and fades, when
 * the weight goes up on last time. Non-interactive, like the record trophy.
 */
export default function WeightIncreaseFloat(props: { increase: Weight }) {
  const { colors } = useAppTheme();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: weightIncreaseFloatDurationMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress]);

  return (
    <Animated.View
      testID="weight-increase-float"
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        elevation: 10,
        opacity: progress.interpolate({
          inputRange: [0, 0.1, 0.6, 1],
          outputRange: [0, 1, 1, 0],
        }),
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -320],
            }),
          },
          {
            scale: progress.interpolate({
              inputRange: [0, 0.15, 1],
              outputRange: [0.6, 1.15, 1],
            }),
          },
        ],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text
          style={{
            ...font['text-2xl'],
            color: colors.tertiary,
            fontWeight: 'bold',
          }}
        >
          +
        </Text>
        <WeightFormat
          weight={props.increase}
          fontSize="text-2xl"
          color="tertiary"
          fontWeight="bold"
        />
      </View>
    </Animated.View>
  );
}
