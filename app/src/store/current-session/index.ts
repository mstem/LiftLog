import {
  SessionBlueprint,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import { ExerciseSwap } from '@/models/exercise-swap';
import { Session } from '@/models/session-models';
import {
  createAction,
  createSelector,
  createSlice,
  PayloadAction,
} from '@reduxjs/toolkit';
import { PlanDiff } from '@/models/blueprint-diff';
import { WorkoutMessage } from '@/models/workout-worker-messages';

interface CurrentSessionState {
  isHydrated: boolean;
  workoutSession: Session | undefined;
  historySession: Session | undefined;
  feedSession: Session | undefined;
  sharedSession: Session | undefined;
  currentPlanDiff: PlanDiff | undefined;
  /**
   * Lifts swapped in per workout id. Kept only while the app runs, like
   * Lightning mode: after a restart Finish offers a swap as a plan change.
   */
  exerciseSwaps: Record<string, ExerciseSwap[]>;
}

export type SessionTarget =
  | 'workoutSession'
  | 'historySession'
  | 'feedSession'
  | 'sharedSession';

const initialState: CurrentSessionState = {
  isHydrated: false,
  workoutSession: undefined,
  historySession: undefined,
  feedSession: undefined,
  sharedSession: undefined,
  currentPlanDiff: undefined,
  exerciseSwaps: {},
};

export const initializeCurrentSessionStateSlice = createAction(
  'initializeCurrentSessionStateSlice',
);

const currentSessionSlice = createSlice({
  name: 'currentSession',
  initialState,
  reducers: {
    setIsHydrated(state, action: PayloadAction<boolean>) {
      state.isHydrated = action.payload;
    },

    setCurrentPlanDiff(state, action: PayloadAction<PlanDiff | undefined>) {
      state.currentPlanDiff = action.payload;
    },

    recordExerciseSwap(
      state,
      action: PayloadAction<{
        sessionId: string;
        from: string;
        to: string;
        original: WeightedExerciseBlueprint;
      }>,
    ) {
      const { sessionId, from, to, original } = action.payload;
      const swaps = (state.exerciseSwaps[sessionId] ??= []);
      // Swapping a swapped-in lift again still stands in for the planned one
      const earlier = swaps.find((x) => x.swappedIn === from);
      if (earlier) {
        earlier.swappedIn = to;
      } else {
        swaps.push({ swappedIn: to, original });
      }
    },

    clearExerciseSwaps(state, action: PayloadAction<string>) {
      delete state.exerciseSwaps[action.payload];
    },

    setCurrentSession: (
      state,
      action: PayloadAction<{
        target: SessionTarget;
        session: Session | undefined;
      }>,
    ) => {
      state[action.payload.target] = action.payload
        .session;
    },
  },
  selectors: {
    selectState: (x) => x,
  },
});

export const selectCurrentSession = createSelector(
  [
    currentSessionSlice.selectors.selectState,
    (_, target: SessionTarget) => target,
  ],
  (state, target) => state[target],
);

/**
 * A workout only counts as in progress once something has been recorded in it.
 * Holding a session as current is not enough: finishing a workout auto-loads the
 * next one, and that untouched session has nothing to resume, nothing to save,
 * and nothing worth a persistent notification.
 */
export const selectIsWorkoutInProgress = createSelector(
  [currentSessionSlice.selectors.selectState],
  (state) => !!state.workoutSession?.isStarted,
);

export const clearSetTimerNotification = createAction(
  'clearSetTimerNotification',
);

export const notifySetTimer = createAction('notifySetTimer');

export const setCurrentSessionFromBlueprint = createAction<{
  target: SessionTarget;
  blueprint: SessionBlueprint;
}>('setCurrentSessionFromBlueprint');

export const persistCurrentSession = createAction<SessionTarget>(
  'persistCurrentSession',
);

export const broadcastWorkoutEvent = createAction<WorkoutMessage['payload']>(
  'broadcastWorkoutEvent',
);

export const finishCurrentWorkout = createAction<SessionTarget>(
  'finishCurrentWorkout',
);

export const currentWorkoutSessionUpdated = createAction<{
  before: Session | undefined;
  after: Session | undefined;
}>('currentWorkoutSessionUpdated');

export const {
  setIsHydrated,
  setCurrentSession,
  setCurrentPlanDiff,
  recordExerciseSwap,
  clearExerciseSwaps,
} = currentSessionSlice.actions;

export const currentSessionReducer = currentSessionSlice.reducer;
