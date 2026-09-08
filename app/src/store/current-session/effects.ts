import { LiftLog } from '@/gen/proto';
import { EmptySession, Session } from '@/models/session-models';
import {
  broadcastWorkoutEvent,
  clearSetTimerNotification,
  currentWorkoutSessionUpdated,
  finishCurrentWorkout,
  initializeCurrentSessionStateSlice,
  notifySetTimer,
  persistCurrentSession,
  selectCurrentSession,
  setCurrentPlanDiff,
  setCurrentSession,
  setCurrentSessionFromBlueprint,
  setIsHydrated,
} from '@/store/current-session';
import { AddEffectFn, RootState } from '@/store/store';
import { fetchUpcomingSessions, selectActiveProgram } from '@/store/program';
import {
  addStoredSession,
  selectLatestExercises,
} from '@/store/stored-sessions';
import { selectPreferredWeightUnit } from '@/store/settings';
import { diffSessionBlueprints } from '@/models/blueprint-diff';
import { addUnpublishedSessionId } from '@/store/feed';
import { setStatsIsDirty } from '@/store/stats';
import {
  getCardioTimerInfo,
  getCurrentExerciseDetails,
  getTimerInfo,
} from '@/store/current-session/helpers';
import { ProtobufToJsonV1Migrator } from '@/models/storage/versions/v1/protobuf-migrator';
import {
  fromJsonString,
  JsonString,
  toDurationJSON,
  toJsonString,
} from '@/models/storage/versions/latest';
import { Duration, OffsetDateTime } from '@js-joda/core';
import { Dispatch } from '@reduxjs/toolkit';
import { KeyValueStore } from '@/services/key-value-store';
import { AnyVersionSessionJSON } from '@/models/storage/versions/any';
import { copyLogs, showSnackbar } from '@/store/app';
import { sessionMigrations } from '@/models/storage/versions/migrations/session';

const storageKey = 'CurrentSessionStateV1';
export function applyCurrentSessionEffects(addEffect: AddEffectFn) {
  addEffect(
    initializeCurrentSessionStateSlice,
    async (_, { dispatch, getState, extra: { keyValueStore, logger } }) => {
      if (!getState().settings.isHydrated) {
        throw new Error('Settings must be hydrated before stored sessions');
      }
      try {
        const currentSessionVersion =
          (await keyValueStore.getItem(`${storageKey}-Version`)) ?? '2';

        switch (currentSessionVersion) {
          case '2':
            await handleV2ProtoStorage(dispatch, keyValueStore, getState);
            break;
          case '3':
            await handleV3JsonStorage(dispatch, keyValueStore);
            break;
        }

        dispatch(setIsHydrated(true));
      } catch (e) {
        logger.error('Failed to initialize current session state', e);
        dispatch(setIsHydrated(true));
        dispatch(
          showSnackbar({
            text: 'Failed to load current session. Please submit a bug report with your logs in settings!',
            action: 'Copy logs',
            dispatchAction: copyLogs(),
          }),
        );
      }

      // Reconcile the worker with what we actually restored. Its notification is
      // owned by a foreground service that outlives the JS process, so if a
      // workout ever ends without the app getting to say so - a crash, the
      // process being killed mid-finish - nothing else would ever clear it, and
      // the notification comes back on every launch. Saying "ended" here is
      // cheap and idempotent when no service is running.
      if (!getState().currentSession.workoutSession?.isStarted) {
        dispatch(broadcastWorkoutEvent({ type: 'WorkoutEndedEvent' }));
      }
    },
  );

  addEffect(
    setCurrentSession,
    async (
      _,
      {
        stateBeforeReduce,
        stateAfterReduce,
        dispatch,
        extra: { keyValueStore, logger },
      },
    ) => {
      const shouldPersistChanges =
        stateAfterReduce.currentSession.isHydrated &&
        stateAfterReduce.currentSession !== stateBeforeReduce.currentSession;

      const currentWorkoutSessionChanged =
        stateBeforeReduce.currentSession.workoutSession !==
        stateAfterReduce.currentSession.workoutSession;
      if (currentWorkoutSessionChanged) {
        dispatch(
          currentWorkoutSessionUpdated({
            before: stateBeforeReduce.currentSession.workoutSession,
            after: stateAfterReduce.currentSession.workoutSession,
          }),
        );
      }

      if (shouldPersistChanges) {
        try {
          await keyValueStore.setItem(`${storageKey}-Version`, '3');
          if (stateAfterReduce.currentSession.workoutSession) {
            await keyValueStore.setItem(
              storageKey,
              toJsonString(
                stateAfterReduce.currentSession.workoutSession.toJSON(),
              ),
            );
          } else {
            await keyValueStore.removeItem(storageKey);
          }
        } catch (e) {
          logger.error('Failed to persist current session state', e);
        }
      }
    },
  );

  addEffect(finishCurrentWorkout, (a, { dispatch, getState }) => {
    const session = selectCurrentSession(getState(), a.payload);
    // An unstarted session has nothing recorded - finishing it must not create
    // a stored workout (that produced empty duplicate sessions in history), nor
    // queue it for feed publish.
    if (session?.isStarted) {
      dispatch(addUnpublishedSessionId(session.id));
    }

    dispatch(persistCurrentSession(a.payload));
    dispatch(setStatsIsDirty(true));
  });

  addEffect(
    persistCurrentSession,
    async (a, { dispatch, getState, extra: { logger } }) => {
      dispatch(clearSetTimerNotification());
      const session = selectCurrentSession(getState(), a.payload);
      // Only persist a session that was actually started - a stray finish on an
      // unstarted session would otherwise store an empty duplicate in history.
      if (session?.isStarted) {
        const program = selectActiveProgram(getState());
        dispatch(addStoredSession(session));
        // The plan diff is best-effort bookkeeping: if it throws, the session
        // must still be cleared below, or the workout gets stuck as current
        // (its stored copy already exists) with the notification running.
        try {
          const sessionInPlan = program.sessions.some((x) =>
            x.equals(session.blueprint),
          );
          if (!sessionInPlan) {
            const sessionWithSameNameInPlan = program.sessions.find(
              (x) => x.name === session.blueprint.name,
            );
            dispatch(
              setCurrentPlanDiff(
                sessionWithSameNameInPlan
                  ? {
                      type: 'diff',
                      diff: diffSessionBlueprints(
                        sessionWithSameNameInPlan,
                        session.blueprint,
                      ),
                      sessionIndex: program.sessions.indexOf(
                        sessionWithSameNameInPlan,
                      ),
                    }
                  : {
                      type: 'add',
                      diff: diffSessionBlueprints(
                        EmptySession.blueprint,
                        session.blueprint,
                      ),
                    },
              ),
            );
          }
        } catch (e) {
          logger.error(
            'Failed to compute plan diff while finishing workout',
            e,
          );
        }
      }
      dispatch(setCurrentSession({ target: a.payload, session: undefined }));
      // Refetching leaves the next workout in the rotation sitting at the top of
      // the upcoming list, ready to start whenever the user next trains. It is
      // deliberately not installed as the current session: that reserved a
      // workout on the day the previous one finished, dated it that day, and
      // read as a workout already under way.
      dispatch(fetchUpcomingSessions());
    },
  );

  addEffect(currentWorkoutSessionUpdated, (action, { dispatch }) => {
    const previousValue = action.payload.before;
    const currentValue = action.payload.after;
    // The worker's notification tracks a workout that is actually under way, not
    // whatever session happens to be loaded. Finishing a workout auto-loads the
    // next one, and treating that as a start put the notification straight back
    // up for a workout the user had not begun - which read as the finished one
    // never closing out.
    const wasInProgress = !!previousValue?.isStarted;
    const isInProgress = !!currentValue?.isStarted;
    if (!wasInProgress && isInProgress) {
      dispatch(broadcastWorkoutEvent({ type: 'WorkoutStartedEvent' }));
    }
    if (
      currentValue?.restTimerEndTime &&
      !currentValue.restTimerEndTime?.isEqual(
        previousValue?.restTimerEndTime ?? OffsetDateTime.MAX,
      )
    ) {
      dispatch(notifySetTimer());
    }
    if (isInProgress && currentValue) {
      dispatch(
        broadcastWorkoutEvent({
          type: 'WorkoutUpdatedEvent',
          workout: currentValue.toJSON(),
          restTimerInfo: getTimerInfo(currentValue),
          cardioTimerInfo: getCardioTimerInfo(currentValue),
          currentExerciseDetails: getCurrentExerciseDetails(currentValue),
          totalWeightLifted: currentValue.totalWeightLifted.toJSON(),
          workoutDuration: toDurationJSON(
            currentValue.duration ?? Duration.ZERO,
          ),
        }),
      );
    }
    if (wasInProgress && !isInProgress) {
      dispatch(broadcastWorkoutEvent({ type: 'WorkoutEndedEvent' }));
    }
  });

  addEffect(
    broadcastWorkoutEvent,
    (action, { extra: { workoutWorkerService } }) => {
      workoutWorkerService.broadcast(action.payload);
    },
  );

  addEffect(
    clearSetTimerNotification,
    async (_, { extra: { notificationService } }) => {
      await notificationService.clearSetTimerNotification();
    },
  );

  addEffect(
    notifySetTimer,
    async (_, { extra: { notificationService }, getState }) => {
      await notificationService.clearSetTimerNotification();
      const {
        settings: { restNotifications },
        currentSession: { workoutSession },
      } = getState();
      if (!restNotifications) {
        return;
      }
      const restTimerEndTime = workoutSession?.restTimerEndTime;
      if (restTimerEndTime && restTimerEndTime.isAfter(OffsetDateTime.now())) {
        await notificationService.scheduleNextSetNotification(restTimerEndTime);
      }
    },
  );

  addEffect(
    setCurrentSessionFromBlueprint,
    async (
      action,
      { stateAfterReduce, dispatch, extra: { sessionService } },
    ) => {
      const session = sessionService.hydrateSessionFromBlueprint(
        action.payload.blueprint,
        selectLatestExercises(stateAfterReduce),
      );
      dispatch(setCurrentSession({ session, target: action.payload.target }));
    },
  );
}

function fromCurrentSessionDao(
  dao: LiftLog.Ui.Models.CurrentSessionStateDao.ICurrentSessionStateDaoV2,
) {
  return {
    workoutSession:
      dao.workoutSession &&
      Session.fromJSON(
        sessionMigrations.migrate(
          ProtobufToJsonV1Migrator.migrateSession(dao.workoutSession),
        ),
      ),
    historySession:
      dao.historySession &&
      Session.fromJSON(
        sessionMigrations.migrate(
          ProtobufToJsonV1Migrator.migrateSession(dao.historySession),
        ),
      ),
  };
}

async function handleV2ProtoStorage(
  dispatch: Dispatch,
  keyValueStore: KeyValueStore,
  getState: () => RootState,
) {
  const bytes =
    (await keyValueStore.getItemBytes(storageKey)) ?? Uint8Array.from([]);
  const currentSessionStateDao =
    LiftLog.Ui.Models.CurrentSessionStateDao.CurrentSessionStateDaoV2.decode(
      bytes,
    );

  if (currentSessionStateDao) {
    const currentSessionState = fromCurrentSessionDao(currentSessionStateDao);
    if (currentSessionState.workoutSession) {
      dispatch(
        setCurrentSession({
          target: 'workoutSession',
          session: currentSessionState.workoutSession.withNoNilWeights(
            selectPreferredWeightUnit(getState()),
          ),
        }),
      );
    }
    if (currentSessionState.historySession) {
      dispatch(
        setCurrentSession({
          target: 'historySession',
          session: currentSessionState.historySession.withNoNilWeights(
            selectPreferredWeightUnit(getState()),
          ),
        }),
      );
    }
  }
}

async function handleV3JsonStorage(
  dispatch: Dispatch,
  keyValueStore: KeyValueStore,
) {
  const bytes = (await keyValueStore.getItem(storageKey)) ?? 'null';
  const currentSessionState = fromJsonString(
    bytes as JsonString<AnyVersionSessionJSON | null>,
  );
  if (!currentSessionState) {
    return;
  }

  dispatch(
    setCurrentSession({
      target: 'workoutSession',
      session: Session.fromJSON(sessionMigrations.migrate(currentSessionState)),
    }),
  );
}
