import Button from '@/components/presentation/foundation/gesture-wrappers/button';
import { NextDayAnswer } from '@/models/injury/injury';
import { pendingNextDayCheck } from '@/models/injury/next-day';
import { useAppSelector } from '@/store';
import { answerNextDay, selectActiveInjury } from '@/store/injury';
import { selectSessions } from '@/store/stored-sessions';
import { OffsetDateTime } from '@js-joda/core';
import { useTranslate } from '@tolgee/react';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Dialog, Portal } from 'react-native-paper';
import { useDispatch } from 'react-redux';

/** Asks once whether the injury is worse after the last pain-tracked workout. */
export function NextDayCheckDialog() {
  const { t } = useTranslate();
  const dispatch = useDispatch();
  const sessions = useAppSelector(selectSessions);
  const injury = useAppSelector(selectActiveInjury);
  const answers = useAppSelector((x) => x.injury.nextDayAnswers);
  const overrides = useAppSelector((x) => x.injury.flagOverrides);
  // Dismissing hides the question for that workout only; a newer one asks again.
  const [dismissedId, setDismissedId] = useState<string>();
  // Refreshed on focus so a session crossing 12 hours prompts without a restart
  const [now, setNow] = useState(() => OffsetDateTime.now());
  useFocusEffect(useCallback(() => setNow(OffsetDateTime.now()), []));

  const pending = useMemo(
    () =>
      pendingNextDayCheck({
        sessions,
        injury,
        answers,
        overrides,
        now,
      }),
    [sessions, injury, answers, overrides, now],
  );

  const answer = (value: NextDayAnswer) => {
    if (pending) {
      dispatch(answerNextDay({ sessionId: pending.id, answer: value }));
    }
  };

  return (
    <Portal>
      <Dialog
        visible={!!pending && pending.id !== dismissedId}
        onDismiss={() => setDismissedId(pending?.id)}
      >
        <Dialog.Title>{t('injury.next_day.question')}</Dialog.Title>
        <Dialog.Actions>
          <Button testID="next-day-no" onPress={() => answer('notWorse')}>
            {t('injury.next_day.no')}
          </Button>
          <Button testID="next-day-yes" onPress={() => answer('worse')}>
            {t('injury.next_day.yes')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
