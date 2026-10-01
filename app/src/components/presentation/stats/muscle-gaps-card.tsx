import { TitledSection } from '@/components/presentation/stats/titled-section';
import { rounding, spacing, useAppTheme } from '@/hooks/useAppTheme';
import {
  MuscleGapRegion,
  muscleGapLevel,
  muscleGapRegions,
  muscleGaps,
  wellTrainedSets,
} from '@/models/muscle-gaps';
import { useAppSelector } from '@/store';
import { selectExercises, selectSessions } from '@/store/stored-sessions';
import { LocalDate } from '@js-joda/core';
import { useTranslate } from '@tolgee/react';
import { useMemo } from 'react';
import { View } from 'react-native';
import Body from 'react-native-body-highlighter';
import { Text } from 'react-native-paper';

const listedGaps = 6;

/**
 * Front and back bodies coloured red for muscles the last 30 days barely
 * reached, through to green for well-trained ones, with the biggest gaps listed.
 */
export function MuscleGapsCard() {
  const { t } = useTranslate();
  const { colors } = useAppTheme();
  const sessions = useAppSelector(selectSessions);
  const exercises = useAppSelector(selectExercises);

  const gaps = useMemo(
    () =>
      muscleGaps({
        sessions,
        library: Object.values(exercises),
        today: LocalDate.now(),
      }),
    [sessions, exercises],
  );

  const data = muscleGapRegions.map((slug) => ({
    slug,
    intensity: muscleGapLevel(gaps[slug]),
  }));
  const scale = [
    colors.red,
    colors.orange,
    colors.amber,
    colors.lime,
    colors.green,
  ];
  const biggestGaps = [...muscleGapRegions]
    .filter((r) => gaps[r] < wellTrainedSets)
    .sort((a, b) => gaps[a] - gaps[b])
    .slice(0, listedGaps);

  return (
    <TitledSection
      title={t('stats.muscle_gaps.title')}
      titleRight={
        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
          {t('stats.muscle_gaps.period')}
        </Text>
      }
    >
      <View
        style={{
          backgroundColor: colors.surfaceContainer,
          borderRadius: rounding.roundedRectangleRadius,
          padding: spacing[3],
          gap: spacing[3],
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
          {(['front', 'back'] as const).map((side) => (
            <Body
              key={side}
              side={side}
              data={data}
              colors={scale}
              scale={0.8}
              border="none"
            />
          ))}
        </View>
        {biggestGaps.length ? (
          <View style={{ gap: spacing[1] }}>
            {biggestGaps.map((region) => (
              <View
                key={region}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <Text variant="bodyMedium">{regionLabel(t, region)}</Text>
                <Text
                  variant="bodyMedium"
                  style={{ color: colors.onSurfaceVariant }}
                >
                  {t('stats.muscle_gaps.sets', {
                    sets: formatSets(gaps[region]),
                  })}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </TitledSection>
  );
}

function formatSets(sets: number) {
  return Number.isInteger(sets) ? sets.toString() : sets.toFixed(1);
}

function regionLabel(
  t: ReturnType<typeof useTranslate>['t'],
  region: MuscleGapRegion,
) {
  return t(`stats.muscle_gaps.region.${region}`);
}
