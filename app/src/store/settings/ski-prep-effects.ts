import { AddEffectFn } from '@/store/store';
import { setSkiPrepUntil } from '@/store/settings';
import { fetchUpcomingSessions } from '@/store/program';

/**
 * Saves the ski prep end date, and rebuilds the upcoming workouts so Legs day
 * gains or loses the ski block straight away, including once the date loads
 * at startup.
 */
export function addSkiPrepEffects(addEffect: AddEffectFn) {
  addEffect(
    setSkiPrepUntil,
    async (
      action,
      { dispatch, stateAfterReduce, extra: { preferenceService } },
    ) => {
      dispatch(fetchUpcomingSessions());
      if (stateAfterReduce.settings.isHydrated) {
        await preferenceService.setSkiPrepUntil(action.payload);
      }
    },
  );
}
