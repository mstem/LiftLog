import FullHeightScrollView from '@/components/layout/full-height-scroll-view';
import IconButton from '@/components/presentation/foundation/gesture-wrappers/icon-button';
import SingleValueStatisticCard from '@/components/presentation/stats/single-value-statistic-card';
import { SingleValueStatisticsGrid } from '@/components/presentation/stats/single-value-statistics-grid';
import { TitledSection } from '@/components/presentation/stats/titled-section';
import { spacing, useAppTheme } from '@/hooks/useAppTheme';
import { monthlyReport, MonthlyReport } from '@/models/monthly-report';
import { MuscleGapRegion } from '@/models/muscle-gaps';
import { useAppSelector } from '@/store';
import { selectExercises, selectSessions } from '@/store/stored-sessions';
import { formatDuration } from '@/utils/format-date';
import { Duration, YearMonth } from '@js-joda/core';
import { useTranslate } from '@tolgee/react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

function parseMonth(value: string | string[] | undefined): YearMonth {
  try {
    return typeof value === 'string' ? YearMonth.parse(value) : YearMonth.now();
  } catch {
    return YearMonth.now();
  }
}

/** Written as "12 (+3)": this month, then the change since last month. */
function withChange(
  now: number,
  before: number,
  format: (n: number) => string = String,
) {
  const change = now - before;
  return before
    ? `${format(now)} (${change >= 0 ? '+' : '-'}${format(Math.abs(change))})`
    : format(now);
}

export default function MonthlyReportPage() {
  const { t } = useTranslate();
  const { colors } = useAppTheme();
  const router = useRouter();
  const monthParam = useLocalSearchParams().month;
  const monthKey = parseMonth(monthParam).toString();
  const month = YearMonth.parse(monthKey);
  const sessions = useAppSelector(selectSessions);
  const exercises = useAppSelector(selectExercises);
  const settings = useAppSelector((x) => x.settings);

  const build = (m: YearMonth) =>
    monthlyReport({
      sessions,
      month: m,
      unit: settings.useImperialUnits ? 'pounds' : 'kilograms',
      library: Object.values(exercises),
      firstDayOfWeek: settings.firstDayOfWeek,
    });
  const report = build(month);
  const previous = build(month.minusMonths(1));

  const monthTitle = new Date(
    month.year(),
    month.monthValue() - 1,
    1,
  ).toLocaleDateString(settings.preferredLanguage, {
    month: 'long',
    year: 'numeric',
  });
  const goTo = (m: YearMonth) => router.setParams({ month: m.toString() });
  const isCurrentMonth = !month.isBefore(YearMonth.now());

  return (
    <FullHeightScrollView contentContainerStyle={{ gap: spacing[4] }}>
      <Stack.Screen options={{ title: t('stats.monthly_report.title') }} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginHorizontal: spacing.pageHorizontalMargin,
        }}
      >
        <IconButton
          icon={'chevronLeft'}
          testID="monthly-report-previous"
          onPress={() => goTo(month.minusMonths(1))}
        />
        <Text variant="titleLarge">{monthTitle}</Text>
        <IconButton
          icon={'chevronRight'}
          testID="monthly-report-next"
          disabled={isCurrentMonth}
          onPress={() => goTo(month.plusMonths(1))}
        />
      </View>
      {report.workouts ? (
        <ReportBody report={report} previous={previous} />
      ) : (
        <Text
          style={{
            marginHorizontal: spacing.pageHorizontalMargin,
            color: colors.onSurfaceVariant,
          }}
        >
          {t('stats.monthly_report.empty')}
        </Text>
      )}
    </FullHeightScrollView>
  );
}

function ReportBody({
  report,
  previous,
}: {
  report: MonthlyReport;
  previous: MonthlyReport;
}) {
  const { t } = useTranslate();
  const showBodyweight = useAppSelector((x) => x.settings.showBodyweight);
  const region = (r: MuscleGapRegion) => t(`stats.muscle_gaps.region.${r}`);
  const minutes = (m: number) =>
    formatDuration(Duration.ofMinutes(m), 'hours-mins');

  return (
    <>
      <TitledSection title={t('stats.overview.title')}>
        <SingleValueStatisticsGrid>
          <SingleValueStatisticCard
            title={t('stats.monthly_report.workouts.label')}
            icon={'assignment'}
            value={withChange(report.workouts, previous.workouts)}
          />
          <SingleValueStatisticCard
            title={t('stats.monthly_report.full_weeks.label')}
            icon={'calendar'}
            value={withChange(
              report.weeksWithThreeOrMore,
              previous.weeksWithThreeOrMore,
            )}
          />
          <SingleValueStatisticCard
            title={t('stats.monthly_report.sets.label')}
            icon={'function'}
            value={withChange(report.sets, previous.sets)}
          />
          <SingleValueStatisticCard
            title={t('stats.monthly_report.volume.label')}
            icon={'weight'}
            value={report.volume.shortLocaleFormat(0)}
          />
          <SingleValueStatisticCard
            title={t('stats.monthly_report.time.label')}
            icon={'avgTime'}
            value={withChange(
              Math.round(report.timeTrained.toMinutes()),
              Math.round(previous.timeTrained.toMinutes()),
              minutes,
            )}
          />
          {showBodyweight && report.bodyweightStart ? (
            <SingleValueStatisticCard
              title={t('stats.bodyweight_change.label')}
              icon={'monitorWeight'}
              value={
                report.bodyweightEnd
                  ? `${report.bodyweightStart.shortLocaleFormat(1)} → ${report.bodyweightEnd.shortLocaleFormat(1)}`
                  : report.bodyweightStart.shortLocaleFormat(1)
              }
            />
          ) : null}
        </SingleValueStatisticsGrid>
      </TitledSection>

      {report.bests.length ? (
        <TitledSection title={t('stats.monthly_report.bests.title')}>
          {report.bests.map((best) => (
            <ReportRow
              key={best.name}
              label={best.name}
              value={`${best.previous.shortLocaleFormat(1)} → ${best.weight.shortLocaleFormat(1)}`}
            />
          ))}
        </TitledSection>
      ) : null}

      <TitledSection title={t('stats.monthly_report.muscles.title')}>
        <ReportRow
          label={t('stats.monthly_report.most_worked.label')}
          value={report.mostWorked.map(region).join(', ') || '-'}
        />
        <ReportRow
          label={t('stats.monthly_report.barely_reached.label')}
          value={report.barelyReached.map(region).join(', ') || '-'}
        />
      </TitledSection>

      <TitledSection title={t('stats.monthly_report.by_name.title')}>
        {report.byName.map((x) => (
          <ReportRow key={x.name} label={x.name} value={String(x.count)} />
        ))}
      </TitledSection>
    </>
  );
}

function ReportRow(props: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing[4],
        paddingVertical: spacing[1],
      }}
    >
      <Text variant="bodyMedium" style={{ flexShrink: 1 }}>
        {props.label}
      </Text>
      <Text
        variant="bodyMedium"
        style={{ color: colors.onSurfaceVariant, textAlign: 'right' }}
      >
        {props.value}
      </Text>
    </View>
  );
}
