import ConfirmationDialog from '@/components/presentation/foundation/confirmation-dialog';
import { Session } from '@/models/session-models';
import { useAppSelector, useAppSelectorWithArg } from '@/store';
import {
  selectCurrentSession,
  selectIsWorkoutInProgress,
  setCurrentSession,
} from '@/store/current-session';
import { T, useTranslate } from '@tolgee/react';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useDebouncedCallback } from 'use-debounce';

export function CurrentWorkoutReplacer({
  session,
  clearSession,
}: {
  session: Session | undefined;
  clearSession: () => void;
}) {
  const { t } = useTranslate();
  // Only a workout with something recorded in it is worth confirming over. The
  // session auto-loaded after finishing a workout has nothing to lose, so asking
  // "replace it without saving?" for it was just noise about a workout the user
  // had never started.
  const workoutInProgress = useAppSelector(selectIsWorkoutInProgress);
  const { push } = useRouter();
  const currentSession = useAppSelectorWithArg(
    selectCurrentSession,
    'workoutSession',
  );
  const activeSessionSameAsSelected = session?.equals(currentSession);
  const dispatch = useDispatch();
  const replaceSession = useDebouncedCallback(
    (session: Session) => {
      clearSession();
      dispatch(
        setCurrentSession({
          target: 'workoutSession',
          session,
        }),
      );
      push('/(session)/session', { withAnchor: true });
    },
    500,
    { leading: true, trailing: false },
  );
  const replaceSessionDialogAction = () => {
    if (!session) return;
    replaceSession(session);
  };
  useEffect(() => {
    if (session && (!workoutInProgress || activeSessionSameAsSelected)) {
      replaceSession(session);
    }
  }, [session, workoutInProgress, replaceSession, activeSessionSameAsSelected]);
  return (
    <ConfirmationDialog
      open={workoutInProgress && !!session && !activeSessionSameAsSelected}
      onCancel={clearSession}
      okText={t('generic.replace.button')}
      onOk={replaceSessionDialogAction}
      headline={<T keyName="workout.replace_current.confirm.title" />}
      textContent={<T keyName="workout.replace_in_progress.confirm.body" />}
    />
  );
}
