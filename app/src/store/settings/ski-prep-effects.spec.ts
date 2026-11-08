import { describe, expect, it, vi } from 'vitest';
import { setSkiPrepUntil } from '@/store/settings';
import { fetchUpcomingSessions } from '@/store/program';
import { addSkiPrepEffects } from '@/store/settings/ski-prep-effects';
import { createAddEffectTestBed } from '@/utils/__test__/add-effect-testbed';

function bed(isHydrated: boolean, skiPrepUntil?: string) {
  const preferenceService = { setSkiPrepUntil: vi.fn(async () => {}) };
  const testBed = createAddEffectTestBed({
    initialState: { settings: { isHydrated, skiPrepUntil } },
    services: { preferenceService },
  });
  addSkiPrepEffects(testBed.addEffect);
  return { testBed, preferenceService };
}

describe('addSkiPrepEffects', () => {
  it('saves the end date and rebuilds the upcoming workouts', async () => {
    const { testBed, preferenceService } = bed(true);
    await testBed.dispatchHandled(setSkiPrepUntil('2027-01-03'));

    expect(preferenceService.setSkiPrepUntil).toHaveBeenCalledWith(
      '2027-01-03',
    );
    expect(testBed.dispatchedActions.some(fetchUpcomingSessions.match)).toBe(
      true,
    );
  });

  it('saves switching it off', async () => {
    const { testBed, preferenceService } = bed(true, '2027-01-03');
    await testBed.dispatchHandled(setSkiPrepUntil(undefined));

    expect(preferenceService.setSkiPrepUntil).toHaveBeenCalledWith(undefined);
  });

  it('does not save the value read at startup back over itself', async () => {
    const { testBed, preferenceService } = bed(false);
    await testBed.dispatchHandled(setSkiPrepUntil('2027-01-03'));

    expect(preferenceService.setSkiPrepUntil).not.toHaveBeenCalled();
    expect(testBed.dispatchedActions.some(fetchUpcomingSessions.match)).toBe(
      true,
    );
  });

  it('rebuilds nothing when the date did not change', async () => {
    const { testBed } = bed(false, undefined);
    await testBed.dispatchHandled(setSkiPrepUntil(undefined));

    expect(testBed.dispatchedActions.some(fetchUpcomingSessions.match)).toBe(
      false,
    );
  });
});
