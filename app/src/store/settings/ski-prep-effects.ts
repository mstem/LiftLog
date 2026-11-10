import { AddEffectFn } from '@/store/store';
import { setSkiPrepUntil } from '@/store/settings';
import { fetchUpcomingSessions } from '@/store/program';

/**
 * Saves the ski prep end date, and rebuilds the upcoming workouts so the ski
 * rotation starts or stops straight away, including once the date loads at
 * startup.
 */
export function addSkiPrepEffects(addEffect: AddEffectFn) {
  addEffect(
    setSkiPrepUntil,
    async (
      action,
      {
        dispatch,
        stateBeforeReduce,
        stateAfterReduce,
        extra: { preferenceService },
      },
    ) => {
      // Startup loads the date even when it is unset; only a change matters
      if (action.payload !== stateBeforeReduce.settings.skiPrepUntil) {
        dispatch(fetchUpcomingSessions());
      }
      if (stateAfterReduce.settings.isHydrated) {
        await preferenceService.setSkiPrepUntil(action.payload);
      }
    },
  );
}
