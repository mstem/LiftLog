import FullHeightScrollView from '@/components/layout/full-height-scroll-view';
import FloatingBottomContainer from '@/components/presentation/foundation/floating-bottom-container';
import { SessionComparisonTable } from '@/components/presentation/workout/session-comparison-table';
import { spacing } from '@/hooks/useAppTheme';
import { useAppSelectorWithArg } from '@/store';
import {
  finishCurrentWorkout,
  selectCurrentSession,
} from '@/store/current-session';
import {
  selectPreviousComparableSession,
  selectSession,
} from '@/store/stored-sessions';
import { useTranslate } from '@tolgee/react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { FAB } from 'react-native-paper';
import { useDispatch } from 'react-redux';

export default function PostWorkoutPage() {
  const { sessionId, source } = useLocalSearchParams<{
    sessionId?: string;
    source?: 'finished' | 'live' | 'history';
  }>();
  const storedSession = useAppSelectorWithArg(selectSession, sessionId ?? '');
  const currentWorkoutSession = useAppSelectorWithArg(
    selectCurrentSession,
    'workoutSession',
  );
  const session =
    storedSession ??
    (currentWorkoutSession?.id === sessionId
      ? currentWorkoutSession
      : undefined);
  const openedAfterFinishingWorkout = source === 'finished';
  const showFinishButton = openedAfterFinishingWorkout;
  const showBackButton = !openedAfterFinishingWorkout;
  const previousComparableSession = useAppSelectorWithArg(
    selectPreviousComparableSession,
    session,
  );
  const { dismissTo } = useRouter();
  const dispatch = useDispatch();
  const { t } = useTranslate();

  // Leaving this screen has to conclude the workout however it happens - the
  // Finish button, the Android back button, a tap on the workout notification
  // that navigates away. Only the button used to finish it, so every other exit
  // silently dropped the save: the workout stayed current with its notification
  // still running, which reads as a completed workout that never closed out.
  const finishedFromButton = useRef(false);
  const stillNeedsFinishing = useRef(false);
  stillNeedsFinishing.current =
    openedAfterFinishingWorkout && currentWorkoutSession?.id === sessionId;
  useEffect(
    () => () => {
      if (!finishedFromButton.current && stillNeedsFinishing.current) {
        dispatch(finishCurrentWorkout('workoutSession'));
      }
    },
    [dispatch],
  );

  useEffect(() => {
    if (!sessionId || !session) {
      dismissTo('/session');
    }
  }, [dismissTo, session, sessionId]);

  if (!sessionId || !session) {
    return null;
  }

  const floatingBottomContainer = showFinishButton ? (
    <FloatingBottomContainer
      fab={
        <FAB
          onPress={() => {
            finishedFromButton.current = true;
            dispatch(finishCurrentWorkout('workoutSession'));
            dismissTo('/');
          }}
          icon={'check'}
          label={t('generic.finish.button')}
        />
      }
    />
  ) : undefined;

  return (
    <FullHeightScrollView
      floatingChildren={floatingBottomContainer}
      scrollStyle={{ paddingHorizontal: spacing.pageHorizontalMargin }}
    >
      <Stack.Screen
        options={{
          presentation: 'modal',
          title: t('workout.post_workout.title'),
          gestureEnabled: showBackButton,
          headerBackVisible: showBackButton,
          headerLeft: showFinishButton ? () => null : undefined!,
        }}
      />
      <View style={{ marginVertical: spacing[4] }}>
        <SessionComparisonTable
          mode="full"
          previousSession={previousComparableSession}
          session={session}
        />
      </View>
    </FullHeightScrollView>
  );
}
