import { describe, it, expect, vi } from 'vitest';
import { UnknownAction } from '@reduxjs/toolkit';
import { applyInjuryEffects } from '@/store/injury/effects';
import {
  answerNextDay,
  hydrateInjuryState,
  initializeInjuryStateSlice,
  resolveInjury,
  restoreInjuryState,
  setFlagOverride,
  setInjury,
} from '@/store/injury';
import { fetchUpcomingSessions } from '@/store/program';
import { showSnackbar } from '@/store/app';
import { setCurrentSession } from '@/store/current-session';
import BigNumber from 'bignumber.js';
import { OffsetDateTime } from '@js-joda/core';
import {
  IncreaseAllEvenlyProgressiveOverload,
  Rest,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import {
  EmptySession,
  PotentialSet,
  RecordedSet,
  RecordedWeightedExercise,
} from '@/models/session-models';
import { Weight } from '@/models/weight';
import { emptyInjuryState, Injury } from '@/models/injury/injury';
import { createAddEffectTestBed } from '@/utils/__test__/add-effect-testbed';
import { RootState } from '@/store/store';

function testBed() {
  const bed = createAddEffectTestBed({
    initialState: {
      injury: { ...emptyInjuryState, isHydrated: true },
    } as unknown as Partial<RootState>,
    services: { keyValueStore: { setItem: vi.fn(), getItem: vi.fn() } },
  });
  applyInjuryEffects(bed.addEffect);
  return bed;
}

describe('injury effects', () => {
  const actions: [string, UnknownAction][] = [
    ['answerNextDay', answerNextDay({ sessionId: 'a', answer: 'worse' })],
    ['setInjury', setInjury(undefined)],
    ['resolveInjury', resolveInjury()],
    ['setFlagOverride', setFlagOverride({ name: 'dips', flagged: true })],
    [
      'hydrateInjuryState',
      hydrateInjuryState({ ...emptyInjuryState, isHydrated: true }),
    ],
    ['restoreInjuryState', restoreInjuryState(emptyInjuryState)],
  ];

  it('saves injury settings restored from a backup', async () => {
    const setItem = vi.fn();
    const bed = createAddEffectTestBed({
      initialState: {
        injury: { ...emptyInjuryState, isHydrated: true },
      } as unknown as Partial<RootState>,
      services: { keyValueStore: { setItem, getItem: vi.fn() } },
    });
    applyInjuryEffects(bed.addEffect);
    await bed.dispatchHandled(restoreInjuryState(emptyInjuryState));
    expect(setItem).toHaveBeenCalledWith('injury', expect.any(String));
  });

  it.each(actions)(
    'regenerates upcoming workouts after %s',
    async (_, action) => {
      const bed = testBed();
      await bed.dispatchHandled(action);
      expect(
        bed.dispatchedActions.filter(
          (x) => x.type === fetchUpcomingSessions.type,
        ),
      ).toHaveLength(1);
    },
  );

  it('re-checks the workout in progress when the pain limit changes', async () => {
    const stopped = new RecordedWeightedExercise(
      new WeightedExerciseBlueprint(
        'Standing Military Press',
        2,
        8,
        new IncreaseAllEvenlyProgressiveOverload(BigNumber(2.5)),
        Rest.medium,
        false,
        '',
        '',
      ),
      [
        new PotentialSet(
          new RecordedSet(8, OffsetDateTime.now(), 6),
          new Weight(20, 'kilograms'),
        ),
        new PotentialSet(undefined, new Weight(20, 'kilograms')),
      ],
      undefined,
    ).withPainStop(5);
    const injury: Injury = {
      slug: 'shoulder',
      name: 'Shoulder',
      side: 'left',
      structures: [],
      onsetDate: '2026-04-25',
      painLimit: 7,
      firstCut: 0.5,
      status: 'active',
      screenFindings: undefined,
      trackedFrom: '2026-04-25T00:00:00Z',
    };
    const bed = createAddEffectTestBed({
      initialState: {
        injury: { ...emptyInjuryState, isHydrated: true, injury },
        currentSession: {
          workoutSession: EmptySession.with({ recordedExercises: [stopped] }),
        },
      } as unknown as Partial<RootState>,
      services: { keyValueStore: { setItem: vi.fn(), getItem: vi.fn() } },
    });
    applyInjuryEffects(bed.addEffect);
    await bed.dispatchHandled(setInjury(injury));
    const { session } = bed.getDispatchedAction(setCurrentSession).payload;
    const lift = session!.recordedExercises[0] as RecordedWeightedExercise;
    expect(lift.stoppedForPain).toBeUndefined();
  });

  it('retries a failed read before giving up', async () => {
    const getItem = vi
      .fn()
      .mockRejectedValueOnce(new Error('disk'))
      .mockResolvedValue(undefined);
    const bed = createAddEffectTestBed({
      services: { keyValueStore: { getItem } },
    });
    applyInjuryEffects(bed.addEffect);
    await bed.dispatchHandled(initializeInjuryStateSlice());
    expect(getItem).toHaveBeenCalledTimes(2);
    expect(
      bed.getDispatchedAction(hydrateInjuryState).payload.saveBlocked,
    ).toBeUndefined();
  });

  it('holds back saving after the stored settings could not be read', async () => {
    const setItem = vi.fn();
    const bed = createAddEffectTestBed({
      initialState: {
        injury: { ...emptyInjuryState, isHydrated: true, saveBlocked: true },
      } as unknown as Partial<RootState>,
      services: {
        keyValueStore: { setItem, getItem: vi.fn() },
        tolgee: { t: (s: string) => s },
      },
    });
    applyInjuryEffects(bed.addEffect);
    await bed.dispatchHandled(setFlagOverride({ name: 'dip', flagged: true }));
    expect(setItem).not.toHaveBeenCalled();
    expect(bed.getDispatchedAction(showSnackbar).payload.text).toBe(
      'injury.save_blocked',
    );
  });

  it('still hydrates when storage cannot be read, so the app does not hang', async () => {
    const bed = createAddEffectTestBed({
      services: {
        keyValueStore: {
          getItem: vi.fn().mockRejectedValue(new Error('disk')),
        },
      },
    });
    applyInjuryEffects(bed.addEffect);
    await bed.dispatchHandled(initializeInjuryStateSlice());
    const payload = bed.getDispatchedAction(hydrateInjuryState).payload;
    expect(payload.isHydrated).toBe(true);
    expect(payload.saveBlocked).toBe(true);
  });
});
