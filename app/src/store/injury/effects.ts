import { AddEffectFn } from '@/store/store';
import {
  answerNextDay,
  hydrateInjuryState,
  initializeInjuryStateSlice,
  resolveInjury,
  restoreInjuryState,
  setFlagOverride,
  setInjury,
} from '@/store/injury';
import { parseInjuryState, serializeInjuryState } from '@/models/injury/injury';
import { fetchUpcomingSessions } from '@/store/program';
import { showSnackbar } from '@/store/app';
import { sleep } from '@/utils/sleep';
import { setCurrentSession } from '@/store/current-session';
import { withPainLimit } from '@/models/injury/pain-limit';

const storageKey = 'injury';
const readAttempts = 3;

export function applyInjuryEffects(addEffect: AddEffectFn) {
  addEffect(
    initializeInjuryStateSlice,
    async (_, { dispatch, extra: { keyValueStore, logger } }) => {
      // The app waits for this slice, so a storage error must still hydrate.
      // It hydrates with saving held back, so the settings that could not be
      // read are not overwritten by the next change.
      for (let attempt = 1; ; attempt++) {
        try {
          const stored = await keyValueStore.getItem(storageKey);
          dispatch(hydrateInjuryState(parseInjuryState(stored)));
          return;
        } catch (e) {
          if (attempt >= readAttempts) {
            logger.error('Failed to load injury settings', e);
            dispatch(
              hydrateInjuryState({
                ...parseInjuryState(undefined),
                saveBlocked: true,
              }),
            );
            return;
          }
          await sleep(200);
        }
      }
    },
  );
  addEffect(
    [
      setInjury,
      resolveInjury,
      setFlagOverride,
      answerNextDay,
      restoreInjuryState,
    ],
    async (
      _,
      { dispatch, stateAfterReduce, extra: { keyValueStore, tolgee } },
    ) => {
      if (!stateAfterReduce.injury.isHydrated) {
        return;
      }
      if (stateAfterReduce.injury.saveBlocked) {
        dispatch(showSnackbar({ text: tolgee.t('injury.save_blocked') }));
        return;
      }
      await keyValueStore.setItem(
        storageKey,
        serializeInjuryState(stateAfterReduce.injury),
      );
    },
  );
  // Upcoming workouts carry injury loads and the Rehab block, so any change
  // here rebuilds them. The workout in progress is left as it is.
  addEffect(
    [
      answerNextDay,
      setInjury,
      resolveInjury,
      setFlagOverride,
      hydrateInjuryState,
      restoreInjuryState,
    ],
    (_, { dispatch }) => {
      dispatch(fetchUpcomingSessions());
    },
  );
  // A changed pain limit, or the injury ending, re-checks the workout in
  // progress, so a lift is not left stopped (or open) under the old limit.
  addEffect(
    [setInjury, resolveInjury, restoreInjuryState],
    (_, { dispatch, stateAfterReduce }) => {
      const session = stateAfterReduce.currentSession.workoutSession;
      if (!session) {
        return;
      }
      const injury = stateAfterReduce.injury.injury;
      const updated = withPainLimit(
        session,
        injury?.status === 'active' ? injury.painLimit : undefined,
      );
      if (updated !== session) {
        dispatch(
          setCurrentSession({ target: 'workoutSession', session: updated }),
        );
      }
    },
  );
}
