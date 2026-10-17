import Button from '@/components/presentation/foundation/gesture-wrappers/button';
import { SurfaceText } from '@/components/presentation/foundation/surface-text';
import { spacing, useAppTheme } from '@/hooks/useAppTheme';
import { OffsetDateTime } from '@js-joda/core';
import { useTranslate } from '@tolgee/react';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Portal } from 'react-native-paper';

const countdownFrom = 5;

/**
 * Counts down 5 seconds so a watch can be started on Go, then reports the Go
 * time, which becomes zero on the workout clock.
 */
export default function WatchCountdown(props: {
  onGo: (time: OffsetDateTime) => void;
}) {
  const { t } = useTranslate();
  const { colors } = useAppTheme();
  const [remaining, setRemaining] = useState<number | undefined>();
  // Held in a ref so a parent re-render mid-count does not restart the second
  const onGo = useRef(props.onGo);
  onGo.current = props.onGo;

  useEffect(() => {
    if (remaining === undefined) {
      return;
    }
    if (remaining === 0) {
      impactAsync(ImpactFeedbackStyle.Heavy).catch(console.log);
      onGo.current(OffsetDateTime.now());
      const hide = setTimeout(() => setRemaining(undefined), 600);
      return () => clearTimeout(hide);
    }
    impactAsync(ImpactFeedbackStyle.Light).catch(console.log);
    const next = setTimeout(() => setRemaining(remaining - 1), 1000);
    return () => clearTimeout(next);
  }, [remaining]);

  return (
    <>
      <Button
        mode="outlined"
        icon={'timer'}
        testID="watch-countdown-button"
        style={{
          marginVertical: spacing[2],
          marginHorizontal: spacing.pageHorizontalMargin,
        }}
        onPress={() => setRemaining(countdownFrom)}
      >
        {t('workout.watch_countdown.button')}
      </Button>
      {remaining !== undefined ? (
        <Portal>
          <View
            testID="watch-countdown"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.inverseSurface,
            }}
          >
            <SurfaceText
              font="text-4xl"
              weight="bold"
              color="inverseOnSurface"
              style={{
                fontVariant: ['tabular-nums'],
                fontSize: 120,
                lineHeight: 140,
              }}
            >
              {remaining === 0 ? t('workout.watch_countdown.go') : remaining}
            </SurfaceText>
          </View>
        </Portal>
      ) : null}
    </>
  );
}
