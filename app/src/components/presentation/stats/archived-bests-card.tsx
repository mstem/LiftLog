import { TitledSection } from '@/components/presentation/stats/titled-section';
import { rounding, spacing, useAppTheme } from '@/hooks/useAppTheme';
import { useAppSelector } from '@/store';
import { selectArchivedWeightedExerciseBests } from '@/store/stored-sessions';
import { useTranslate } from '@tolgee/react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

/** All-time bests per exercise, shown while an injury limits in-workout bests. */
export function ArchivedBestsCard() {
  const { t } = useTranslate();
  const { colors } = useAppTheme();
  const bests = useAppSelector(selectArchivedWeightedExerciseBests);

  if (!bests.length) return null;

  return (
    <TitledSection title={t('injury.archive.title')}>
      <View
        style={{
          backgroundColor: colors.surfaceContainer,
          borderRadius: rounding.roundedRectangleRadius,
          padding: spacing[3],
          gap: spacing[1],
        }}
      >
        {bests.map(({ name, best }) => (
          <View
            key={name}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: spacing[2],
            }}
          >
            <Text variant="bodyMedium" style={{ flexShrink: 1 }}>
              {name}
            </Text>
            <Text
              variant="bodyMedium"
              style={{ color: colors.onSurfaceVariant }}
            >
              {[
                best.maxWeight?.shortLocaleFormat(),
                best.maxReps !== undefined
                  ? t('injury.archive.reps', { reps: best.maxReps })
                  : undefined,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        ))}
      </View>
    </TitledSection>
  );
}
