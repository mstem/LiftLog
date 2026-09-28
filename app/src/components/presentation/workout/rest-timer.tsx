import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ColorChoice, spacing, useAppTheme } from '@/hooks/useAppTheme';
import { Rest } from '@/models/blueprint-models';
import { Duration, OffsetDateTime } from '@js-joda/core';
import Svg, { Path } from 'react-native-svg';
import { Animated, View, ViewStyle } from 'react-native';
import { SurfaceText } from '@/components/presentation/foundation/surface-text';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import { AudioPlayer, setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import Holdable from '@/components/presentation/foundation/holdable';
import { Jiggler } from '@/components/presentation/foundation/jiggler';
import Button from '@/components/presentation/foundation/gesture-wrappers/button';
import { restEndTimeOfDay } from '@/components/presentation/workout/rest-end-time';
import { useAppSelector } from '@/store';
import clickSound from '../../../../assets/click.wav';

// expo-audio exposes volume only as a settable property on the player object,
// so a plain assignment in the component body trips the "don't mutate a hook's
// return value" lint. Doing it here keeps that one legitimate mutation in a
// single, named place.
function setPlayerVolume(player: AudioPlayer, volume: number) {
  player.volume = volume;
}

interface RestTimerProps {
  rest: Rest;
  startTime: OffsetDateTime;
  failed: boolean;
  style?: ViewStyle;
  resetTimer: () => void;
  adjustRest: (amount: Duration) => void;
}

export default function RestTimer({
  rest: restProp,
  startTime,
  failed,
  style,
  resetTimer,
  adjustRest,
}: RestTimerProps) {
  const { colors } = useAppTheme();
  const locale = useAppSelector((x) => x.settings.preferredLanguage);
  const rest = Rest.orDefault(restProp);
  const isSameMinMaxRest = rest.minRest.equals(rest.maxRest);
  const [jiggled, setJiggled] = useState([] as string[]);
  const clickPlayer = useAudioPlayer(clickSound);

  useEffect(() => {
    // Play in silent mode and mix with (rather than pause) the user's music.
    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
      interruptionModeAndroid: 'duckOthers',
    }).catch(console.log);
  }, []);

  useEffect(() => {
    // Prime the player with a muted play-through: media3 swallows the first
    // play of a fully pre-buffered short clip (the 60ms click never reaches
    // the AudioTrack), so burn that first play silently here. Subsequent
    // plays (after ENDED -> seekTo flush) are audible.
    setPlayerVolume(clickPlayer, 0);
    clickPlayer.play();
  }, [clickPlayer]);

  const getTimerState = useCallback(() => {
    const now = OffsetDateTime.now();
    const diffMs = Duration.between(startTime, now);
    // Count down to the next rest milestone (min rest, then max rest, or
    // failure rest after a failed set), then count up overtime with a +.
    const finalMilestone = failed
      ? rest.failureRest
      : isSameMinMaxRest
        ? rest.minRest
        : rest.maxRest;
    const milestones = failed
      ? [rest.failureRest]
      : [rest.minRest, rest.maxRest];
    const nextMilestone = milestones.find((m) => diffMs.compareTo(m) < 0);
    const displayTime = nextMilestone
      ? formatTimeSpan(nextMilestone.minus(diffMs), 'ceil')
      : `+${formatTimeSpan(diffMs.minus(finalMilestone))}`;
    // Nothing to show once the last milestone has passed: the rest has ended.
    const restEndTime = nextMilestone
      ? restEndTimeOfDay(startTime, nextMilestone, locale)
      : undefined;
    // +15 straight after a set puts the start in the future, so elapsed time
    // can be negative; the ring starts empty rather than running backwards.
    const firstProgressBarProgress = Math.max(
      0,
      failed
        ? Math.min(diffMs.toMillis() / rest.failureRest.toMillis(), 1)
        : Math.min(diffMs.toMillis() / rest.minRest.toMillis(), 1),
    );
    const secondProgressBarProgress =
      failed || isSameMinMaxRest
        ? -1
        : Math.min(
            (diffMs.toMillis() - rest.minRest.toMillis()) /
              (rest.maxRest.toMillis() - rest.minRest.toMillis()),
            1,
          );
    const [textColor, backgroundColor]: [ColorChoice, ColorChoice] =
      firstProgressBarProgress < 1
        ? ['inverseOnSurface', 'inverseSurface']
        : secondProgressBarProgress < 1 && secondProgressBarProgress !== -1
          ? ['onGreen', 'green']
          : ['onErrorContainer', 'errorContainer'];
    return {
      displayTime,
      restEndTime,
      firstProgressBarProgress,
      secondProgressBarProgress,
      textColor,
      backgroundColor,
    };
  }, [startTime, rest, failed, isSameMinMaxRest, locale]);

  useEffect(() => {
    // A new rest clears every milestone. Nudging the running rest by 15s only
    // clears the ones it moved back into the future, so pressing +15 after the
    // rest ended clicks again at the new end, and a milestone already passed
    // doesn't click a second time.
    const state = getTimerState();
    setJiggled((j) =>
      j.filter(
        (m) =>
          (m === 'first' && state.firstProgressBarProgress === 1) ||
          (m === 'second' && state.secondProgressBarProgress === 1),
      ),
    );
  }, [getTimerState]);

  const [timerState, setTimerState] = useState(getTimerState());
  const [jiggling, setJiggling] = useState(false);

  const triggerJiggle = useCallback(
    (milestone: string) => {
      if (jiggled.includes(milestone)) return;
      impactAsync(ImpactFeedbackStyle.Heavy).catch(console.log);
      setPlayerVolume(clickPlayer, 1);
      clickPlayer
        .seekTo(0)
        .then(() => clickPlayer.play())
        .catch(console.log);
      setJiggling(true);
      setTimeout(() => setJiggling(false), 10);
      setJiggled((j) => [...j, milestone]);
    },
    [jiggled, clickPlayer],
  );

  const pillHeight = spacing[14];
  const pillWidth = pillHeight * 2.2;
  const radius = (pillHeight - 6) / 2;
  const straightLength = pillWidth - pillHeight;
  const pillPerimeter = 2 * straightLength + 2 * Math.PI * radius;

  useEffect(() => {
    const timer = setInterval(() => {
      const state = getTimerState();
      setTimerState(state);
      if (state.firstProgressBarProgress === 1) triggerJiggle('first');
      if (state.secondProgressBarProgress === 1) triggerJiggle('second');
    }, 200);
    return () => clearInterval(timer);
  }, [getTimerState, triggerJiggle]);

  // The buttons tuck under the pill's rounded ends, and pad that side by the
  // same amount so the label stays centred on the part left showing.
  const buttonOverlap = pillHeight / 2;
  const adjustButton = (seconds: number) => (
    <Button
      testID={`rest-timer-adjust-${seconds}`}
      mode="contained-tonal"
      onPress={() => adjustRest(Duration.ofSeconds(seconds))}
      labelStyle={{ fontVariant: ['tabular-nums'] }}
      style={[
        { borderWidth: 2, borderColor: colors.primary },
        seconds < 0
          ? { marginRight: -buttonOverlap }
          : { marginLeft: -buttonOverlap },
      ]}
      contentStyle={
        seconds < 0
          ? { paddingRight: buttonOverlap }
          : { paddingLeft: buttonOverlap }
      }
    >
      {seconds > 0 ? `+${seconds}` : `\u2212${-seconds}`}
    </Button>
  );

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      {adjustButton(-15)}
      {/* Drawn over both buttons; without zIndex the +15, which comes later,
          would sit on top of the pill. */}
      <View style={{ zIndex: 1 }}>
        <Holdable
          onLongPress={() => {
            resetTimer();
            triggerJiggle('reset');
          }}
        >
          <Jiggler
            testID="rest-timer"
            jiggling={jiggling}
            style={[
              {
                width: pillWidth,
                height: pillHeight,
                pointerEvents: 'none',
                overflow: 'hidden',
                borderRadius: pillHeight,
                backgroundColor: colors[timerState.backgroundColor],
                alignItems: 'center',
                justifyContent: 'center',
              },
              style,
            ]}
          >
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Svg width={pillWidth} height={pillHeight}>
                <PillProgressBar
                  color={colors.primary}
                  progress={timerState.firstProgressBarProgress}
                  pillWidth={pillWidth}
                  pillHeight={pillHeight}
                  pillPerimeter={pillPerimeter}
                />
                <PillProgressBar
                  color={colors.orange}
                  progress={timerState.secondProgressBarProgress}
                  pillWidth={pillWidth}
                  pillHeight={pillHeight}
                  pillPerimeter={pillPerimeter}
                  visible={
                    !failed &&
                    !isSameMinMaxRest &&
                    timerState.secondProgressBarProgress > 0
                  }
                />
              </Svg>
            </View>
            <SurfaceText
              style={{ fontVariant: ['tabular-nums'] }}
              font="text-2xl"
              weight="bold"
              color={timerState.textColor}
            >
              {timerState.displayTime}
            </SurfaceText>
            {timerState.restEndTime ? (
              <SurfaceText
                testID="rest-timer-end-time"
                style={{ fontVariant: ['tabular-nums'] }}
                font="text-xs"
                color={timerState.textColor}
              >
                {timerState.restEndTime}
              </SurfaceText>
            ) : undefined}
          </Jiggler>
        </Holdable>
      </View>
      {adjustButton(15)}
    </View>
  );
}

function formatTimeSpan(
  ms: Duration,
  round: 'floor' | 'ceil' = 'floor',
): string {
  const totalSeconds = Math[round](ms.toMillis() / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface PillProgressBarProps {
  color: string;
  progress: number;
  pillWidth: number;
  pillHeight: number;
  pillPerimeter: number;
  visible?: boolean;
}

function PillProgressBar({
  color,
  progress,
  pillWidth,
  pillHeight,
  pillPerimeter,
  visible = true,
}: PillProgressBarProps) {
  const offset = useRef(new Animated.Value(pillPerimeter)).current;

  useEffect(() => {
    Animated.timing(offset, {
      toValue: pillPerimeter * (1 - progress),
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [progress, pillPerimeter, offset]);

  if (!visible) return null;

  return (
    <AnimatedPath
      d={`M${3 + pillHeight / 2 - 3},3
          h${pillWidth - pillHeight + 0}
          a${pillHeight / 2 - 3},${pillHeight / 2 - 3} 0 0 1 0,${pillHeight - 6}
          h-${pillWidth - pillHeight + 0}
          a${pillHeight / 2 - 3},${pillHeight / 2 - 3} 0 0 1 0,-${pillHeight - 6}
          z`}
      stroke={color}
      strokeWidth={6}
      fill="none"
      strokeDasharray={pillPerimeter}
      strokeDashoffset={offset}
    />
  );
}
