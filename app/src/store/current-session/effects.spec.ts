import { describe, it, expect, vi } from 'vitest';
import {
  initializeCurrentSessionStateSlice,
  setCurrentSession,
  setIsHydrated,
  currentWorkoutSessionUpdated,
} from '@/store/current-session';
import { RootState } from '@/store/store';
import { applyCurrentSessionEffects } from '@/store/current-session/effects';
import { createAddEffectTestBed } from '@/utils/__test__/add-effect-testbed';
import { EmptySession, Session } from '@/models/session-models';
import { setAutoLoadNext, setUpcomingSessions } from '@/store/program';
import { RemoteData } from '@/models/remote';
import {
  finishCurrentWorkout,
  persistCurrentSession,
} from '@/store/current-session';
import { addStoredSession } from '@/store/stored-sessions';
import { addUnpublishedSessionId } from '@/store/feed';
import {
  NoProgressiveOverload,
  Rest,
  SessionBlueprint,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import { LocalDate, OffsetDateTime } from '@js-joda/core';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeKeyValueStore(
  overrides?: Partial<ReturnType<typeof defaultKvStore>>,
) {
  return { ...defaultKvStore(), ...overrides };
}

function defaultKvStore() {
  return {
    getItem: vi.fn().mockResolvedValue(null),
    getItemBytes: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  };
}

const hydratedSettingsState = {
  settings: { isHydrated: true },
} as Partial<RootState>;

describe('current-session effects', () => {
  // ─── initializeCurrentSessionStateSlice ──────────────────────────────────────

  describe('applyCurrentSessionEffects — initializeCurrentSessionStateSlice', () => {
    it('dispatches setIsHydrated(true) when there is no stored session', async () => {
      const testBed = createAddEffectTestBed({
        initialState: hydratedSettingsState,
        services: { keyValueStore: makeKeyValueStore() },
      });
      applyCurrentSessionEffects(testBed.addEffect);

      await testBed.dispatchHandled(initializeCurrentSessionStateSlice());

      const action = testBed.getDispatchedAction(setIsHydrated);
      expect(action.payload).toBe(true);
    });

    it('throws and logs if settings are not yet hydrated', async () => {
      const testBed = createAddEffectTestBed({
        initialState: { settings: { isHydrated: false } },
        services: { keyValueStore: makeKeyValueStore() },
      });
      applyCurrentSessionEffects(testBed.addEffect);

      await testBed.dispatchHandled(initializeCurrentSessionStateSlice());

      testBed.expectNotDispatched(setIsHydrated);
    });

    it('dispatches setIsHydrated(true) when version key is missing (defaults to v2 path with empty bytes)', async () => {
      const kvStore = makeKeyValueStore({
        getItem: vi.fn().mockImplementation((key: string) => {
          if (key === 'CurrentSessionStateV1-Version')
            return Promise.resolve(null);
          return Promise.resolve(null);
        }),
        getItemBytes: vi.fn().mockResolvedValue(new Uint8Array()),
      });
      const testBed = createAddEffectTestBed({
        initialState: hydratedSettingsState,
        services: { keyValueStore: kvStore },
      });
      applyCurrentSessionEffects(testBed.addEffect);

      await testBed.dispatchHandled(initializeCurrentSessionStateSlice());

      const action = testBed.getDispatchedAction(setIsHydrated);
      expect(action.payload).toBe(true);
    });

    it('dispatches setIsHydrated(true) on v3 path with null stored value', async () => {
      const kvStore = makeKeyValueStore({
        getItem: vi.fn().mockImplementation((key: string) => {
          if (key === 'CurrentSessionStateV1-Version')
            return Promise.resolve('3');
          if (key === 'CurrentSessionStateV1') return Promise.resolve(null);
          return Promise.resolve(null);
        }),
      });
      const testBed = createAddEffectTestBed({
        initialState: hydratedSettingsState,
        services: { keyValueStore: kvStore },
      });
      applyCurrentSessionEffects(testBed.addEffect);

      await testBed.dispatchHandled(initializeCurrentSessionStateSlice());

      const action = testBed.getDispatchedAction(setIsHydrated);
      expect(action.payload).toBe(true);
    });

    it('logs and continues if keyValueStore throws', async () => {
      const kvStore = makeKeyValueStore({
        getItem: vi.fn().mockRejectedValue(new Error('storage failure')),
      });
      const testBed = createAddEffectTestBed({
        initialState: hydratedSettingsState,
        services: { keyValueStore: kvStore },
      });
      applyCurrentSessionEffects(testBed.addEffect);

      await testBed.dispatchHandled(initializeCurrentSessionStateSlice());

      expect(testBed.mockServices.logger.error).toHaveBeenCalledWith(
        'Failed to initialize current session state',
        expect.objectContaining({ message: 'storage failure' }),
      );
      const dispatched = testBed.getDispatchedAction(setIsHydrated);
      expect(dispatched).toMatchObject({ payload: true });
    });
  });

  // ─── setCurrentSession ────────────────────────────────────────────────────────

  describe('applyCurrentSessionEffects — setCurrentSession', () => {
    it('persists to keyValueStore when hydrated and session state changed', async () => {
      const kvStore = makeKeyValueStore();
      const testBed = createAddEffectTestBed({
        initialState: {
          currentSession: {
            isHydrated: true,
            workoutSession: undefined,
            historySession: undefined,
          },
        },
        services: { keyValueStore: kvStore },
      });
      applyCurrentSessionEffects(testBed.addEffect);

      // setState simulates the reducer having run — stateAfterReduce differs from stateBeforeReduce
      testBed.setStateBeforeReduce({
        currentSession: {
          isHydrated: true,
          workoutSession: EmptySession,
          historySession: undefined,
        },
      });

      await testBed.dispatchHandled(
        setCurrentSession({ target: 'workoutSession', session: undefined }),
      );

      expect(kvStore.setItem).toHaveBeenCalledWith(
        'CurrentSessionStateV1-Version',
        '3',
      );
      expect(kvStore.removeItem).toHaveBeenCalledWith('CurrentSessionStateV1');
    });

    it('does not persist when not yet hydrated', async () => {
      const kvStore = makeKeyValueStore();
      const testBed = createAddEffectTestBed({
        initialState: {
          currentSession: {
            isHydrated: false,
            workoutSession: undefined,
            historySession: undefined,
          },
        },
        services: { keyValueStore: kvStore },
      });
      applyCurrentSessionEffects(testBed.addEffect);

      await testBed.dispatchHandled(
        setCurrentSession({ target: 'workoutSession', session: undefined }),
      );

      expect(kvStore.setItem).not.toHaveBeenCalled();
    });

    it('dispatches currentWorkoutSessionUpdated when workoutSession changes', async () => {
      const before = EmptySession;
      const after = before.with({ id: '1234' });
      const testBed = createAddEffectTestBed({
        initialState: {
          currentSession: {
            isHydrated: true,
            workoutSession: before,
            historySession: undefined,
          },
        },
        services: { keyValueStore: makeKeyValueStore() },
      });
      applyCurrentSessionEffects(testBed.addEffect);

      testBed.setState({
        currentSession: {
          isHydrated: true,
          workoutSession: after,
          historySession: undefined,
        },
      });

      await testBed.dispatchHandled(
        setCurrentSession({ target: 'workoutSession', session: after }),
      );

      const action = testBed.getDispatchedAction(currentWorkoutSessionUpdated);
      expect(action.payload.before).toBe(before);
      expect(action.payload.after).toBe(after);
    });

    it('does not dispatch currentWorkoutSessionUpdated when workoutSession is unchanged', async () => {
      const session = EmptySession;
      const testBed = createAddEffectTestBed({
        initialState: {
          currentSession: {
            isHydrated: true,
            workoutSession: session,
            historySession: undefined,
          },
        },
        services: { keyValueStore: makeKeyValueStore() },
      });
      applyCurrentSessionEffects(testBed.addEffect);

      // stateAfterReduce same as original — no change
      await testBed.dispatchHandled(
        setCurrentSession({ target: 'workoutSession', session }),
      );

      testBed.expectNotDispatched(currentWorkoutSessionUpdated);
    });

    it('logs but does not rethrow if persist fails', async () => {
      const kvStore = makeKeyValueStore({
        setItem: vi.fn().mockRejectedValue(new Error('disk full')),
      });
      const testBed = createAddEffectTestBed({
        initialState: {
          currentSession: {
            isHydrated: true,
            workoutSession: undefined,
            historySession: undefined,
          },
        },
        services: { keyValueStore: kvStore },
      });
      applyCurrentSessionEffects(testBed.addEffect);

      testBed.setState({
        currentSession: {
          isHydrated: true,
          workoutSession: { id: 'new' },
          historySession: undefined,
        },
      });

      await expect(
        testBed.dispatchHandled(
          setCurrentSession({ target: 'workoutSession', session: undefined }),
        ),
      ).resolves.not.toThrow();

      expect(testBed.mockServices.logger.error).toHaveBeenCalledWith(
        'Failed to persist current session state',
        expect.objectContaining({ message: 'disk full' }),
      );
    });
  });

  // ─── auto-load next (setUpcomingSessions) ─────────────────────────────────────

  describe('applyCurrentSessionEffects — auto-load next session', () => {
    const nextSession = EmptySession.with({ id: 'next-session' });

    function bed(overrides: Partial<RootState>) {
      const testBed = createAddEffectTestBed({
        initialState: {
          currentSession: {
            isHydrated: true,
            workoutSession: undefined,
            historySession: undefined,
          },
          program: {
            autoLoadNext: false,
            upcomingSessions: RemoteData.notAsked(),
          },
          ...overrides,
        },
      });
      applyCurrentSessionEffects(testBed.addEffect);
      return testBed;
    }

    it('loads the freshly-fetched next session when autoLoadNext is set', async () => {
      const testBed = bed({
        program: {
          autoLoadNext: true,
          upcomingSessions: RemoteData.success([nextSession]),
        },
      } as unknown as Partial<RootState>);

      await testBed.dispatchHandled(
        setUpcomingSessions(RemoteData.success([nextSession])),
      );

      expect(testBed.getDispatchedAction(setCurrentSession).payload).toEqual({
        target: 'workoutSession',
        session: nextSession,
      });
      expect(testBed.getDispatchedAction(setAutoLoadNext).payload).toBe(false);
    });

    it('does nothing when autoLoadNext is not set', async () => {
      const testBed = bed({
        program: {
          autoLoadNext: false,
          upcomingSessions: RemoteData.success([nextSession]),
        },
      } as unknown as Partial<RootState>);

      await testBed.dispatchHandled(
        setUpcomingSessions(RemoteData.success([nextSession])),
      );

      testBed.expectNotDispatched(setCurrentSession);
    });

    it('does not clobber an in-progress workout', async () => {
      const testBed = bed({
        currentSession: {
          isHydrated: true,
          workoutSession: EmptySession,
          historySession: undefined,
        },
        program: {
          autoLoadNext: true,
          upcomingSessions: RemoteData.success([nextSession]),
        },
      } as unknown as Partial<RootState>);

      await testBed.dispatchHandled(
        setUpcomingSessions(RemoteData.success([nextSession])),
      );

      testBed.expectNotDispatched(setCurrentSession);
    });

    it('disarms autoLoadNext without loading anything when the upcoming list is empty', async () => {
      const testBed = bed({
        program: {
          autoLoadNext: true,
          upcomingSessions: RemoteData.success([]),
        },
      } as unknown as Partial<RootState>);

      await testBed.dispatchHandled(
        setUpcomingSessions(RemoteData.success([])),
      );

      // The one-shot flag must be cleared even with nothing to load, so a later
      // unrelated refetch can't silently install a workout.
      expect(testBed.getDispatchedAction(setAutoLoadNext).payload).toBe(false);
      testBed.expectNotDispatched(setCurrentSession);
    });

    it('leaves autoLoadNext armed for a non-success (loading) list', async () => {
      const testBed = bed({
        program: {
          autoLoadNext: true,
          upcomingSessions: RemoteData.loading(),
        },
      } as unknown as Partial<RootState>);

      await testBed.dispatchHandled(setUpcomingSessions(RemoteData.loading()));

      testBed.expectNotDispatched(setAutoLoadNext);
      testBed.expectNotDispatched(setCurrentSession);
    });
  });

  // ─── finishing does not persist an unstarted session ──────────────────────────

  describe('applyCurrentSessionEffects — finish only persists started sessions', () => {
    const blueprint = new SessionBlueprint(
      'Legs',
      [
        new WeightedExerciseBlueprint(
          'Squat',
          3,
          10,
          new NoProgressiveOverload(),
          Rest.medium,
          false,
          '',
          '',
        ),
      ],
      '',
    );

    const unstartedSession = Session.getEmptySession(blueprint, 'kilograms');
    const startedSession = unstartedSession.withCycledExerciseReps(
      0,
      0,
      OffsetDateTime.now(),
    );

    function bed(session: Session) {
      const testBed = createAddEffectTestBed({
        initialState: {
          currentSession: {
            isHydrated: true,
            workoutSession: session,
            historySession: undefined,
          },
          program: {
            activePlanId: 'p1',
            savedPrograms: {
              p1: {
                name: 'Plan',
                sessions: [blueprint],
                lastEdited: LocalDate.now(),
              },
            },
            autoLoadNext: false,
            upcomingSessions: RemoteData.notAsked(),
          },
        } as unknown as Partial<RootState>,
        services: { keyValueStore: makeKeyValueStore() },
      });
      applyCurrentSessionEffects(testBed.addEffect);
      return testBed;
    }

    it('persist does not store an unstarted session, but still clears it', async () => {
      const testBed = bed(unstartedSession);

      await testBed.dispatchHandled(persistCurrentSession('workoutSession'));

      testBed.expectNotDispatched(addStoredSession);
      // The current session is still cleared so nothing gets stuck.
      const cleared = testBed.getDispatchedAction(setCurrentSession);
      expect(cleared.payload).toEqual({
        target: 'workoutSession',
        session: undefined,
      });
    });

    it('persist stores a started session', async () => {
      const testBed = bed(startedSession);

      await testBed.dispatchHandled(persistCurrentSession('workoutSession'));

      expect(testBed.getDispatchedAction(addStoredSession).payload).toBe(
        startedSession,
      );
    });

    it('finish does not queue-publish an unstarted session', async () => {
      const testBed = bed(unstartedSession);

      await testBed.dispatchHandled(finishCurrentWorkout('workoutSession'));

      testBed.expectNotDispatched(addUnpublishedSessionId);
    });

    it('finish queues a started session for publish', async () => {
      const testBed = bed(startedSession);

      await testBed.dispatchHandled(finishCurrentWorkout('workoutSession'));

      expect(testBed.getDispatchedAction(addUnpublishedSessionId).payload).toBe(
        startedSession.id,
      );
    });
  });
});
