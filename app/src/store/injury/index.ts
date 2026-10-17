import {
  emptyInjuryState,
  Injury,
  InjuryState,
  NextDayAnswer,
} from '@/models/injury/injury';
import { createAction, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/store';

export const initializeInjuryStateSlice = createAction(
  'initializeInjuryStateSlice',
);

const injurySlice = createSlice({
  name: 'injury',
  initialState: emptyInjuryState,
  reducers: {
    hydrateInjuryState(_, action: PayloadAction<InjuryState>) {
      return action.payload;
    },
    /** Replaces the injury settings with the ones from a restored backup. */
    restoreInjuryState(_, action: PayloadAction<InjuryState>) {
      return { ...action.payload, isHydrated: true };
    },
    setInjury(state, action: PayloadAction<Injury | undefined>) {
      state.injury = action.payload;
    },
    resolveInjury(state) {
      if (state.injury) {
        state.injury.status = 'resolved';
      }
    },
    setFlagOverride(
      state,
      action: PayloadAction<{ name: string; flagged: boolean | undefined }>,
    ) {
      if (action.payload.flagged === undefined) {
        delete state.flagOverrides[action.payload.name];
      } else {
        state.flagOverrides[action.payload.name] = action.payload.flagged;
      }
    },
    answerNextDay(
      state,
      action: PayloadAction<{ sessionId: string; answer: NextDayAnswer }>,
    ) {
      state.nextDayAnswers[action.payload.sessionId] = action.payload.answer;
    },
  },
});

export const {
  hydrateInjuryState,
  restoreInjuryState,
  setInjury,
  resolveInjury,
  setFlagOverride,
  answerNextDay,
} = injurySlice.actions;
export const injuryReducer = injurySlice.reducer;

export const selectActiveInjury = (state: RootState): Injury | undefined =>
  state.injury.injury?.status === 'active' ? state.injury.injury : undefined;
