import FullHeightScrollView from '@/components/layout/full-height-scroll-view';
import ListSwitch from '@/components/presentation/foundation/list-switch';
import { spacing } from '@/hooks/useAppTheme';
import { defaultSkiPrepUntil, isSkiPrepActive } from '@/models/ski-prep';
import { RootState, useAppSelector } from '@/store';
import { setSkiPrepUntil } from '@/store/settings';
import { LocalDate } from '@js-joda/core';
import { T, useTranslate } from '@tolgee/react';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { List } from 'react-native-paper';
import { DatePickerInput } from 'react-native-paper-dates';
import { useDispatch } from 'react-redux';

export default function SkiPrepSettings() {
  const { t } = useTranslate();
  const dispatch = useDispatch();
  const until = useAppSelector((s: RootState) => s.settings.skiPrepUntil);
  const today = LocalDate.now();
  const active = isSkiPrepActive(until, today);
  const untilDate = active && until ? LocalDate.parse(until) : undefined;

  return (
    <FullHeightScrollView>
      <Stack.Screen options={{ title: t('settings.ski_prep.title') }} />
      <List.Section>
        <ListSwitch
          headline={<T keyName="settings.ski_prep.title" />}
          supportingText={<T keyName="settings.ski_prep.switch.subtitle" />}
          value={active}
          onValueChange={(on) =>
            dispatch(
              setSkiPrepUntil(on ? defaultSkiPrepUntil(today) : undefined),
            )
          }
        />
      </List.Section>
      {untilDate ? (
        <View style={{ paddingHorizontal: spacing.pageHorizontalMargin }}>
          <DatePickerInput
            locale="default"
            inputMode="start"
            label={t('settings.ski_prep.until')}
            value={
              new Date(
                untilDate.year(),
                untilDate.monthValue() - 1,
                untilDate.dayOfMonth(),
              )
            }
            // The block stops on the end date, so the earliest is tomorrow
            validRange={{
              startDate: new Date(
                today.year(),
                today.monthValue() - 1,
                today.dayOfMonth() + 1,
              ),
            }}
            onChange={(e) => {
              if (e) {
                dispatch(
                  setSkiPrepUntil(
                    LocalDate.of(
                      e.getFullYear(),
                      e.getMonth() + 1,
                      e.getDate(),
                    ).toString(),
                  ),
                );
              }
            }}
          />
        </View>
      ) : null}
    </FullHeightScrollView>
  );
}
