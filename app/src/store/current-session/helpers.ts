import {
  RecordedCardioExercise,
  RecordedWeightedExercise,
  Session,
} from '@/models/session-models';
import { Rest } from '@/models/blueprint-models';
import {
  toDurationJSON,
  toInstantJson,
} from '@/models/storage/versions/latest';
import {
  CardioTimerInfo,
  CurrentExerciseDetails,
  RestTimerInfo,
} from '@/models/workout-worker-messages';
import { Duration } from '@js-joda/core';
import { match, P } from 'ts-pattern';

export function getCardioTimerInfo(
  session: Session,
): CardioTimerInfo | undefined {
  const exerciseIndex = session.recordedExercises.findIndex(
    (x) =>
      x instanceof RecordedCardioExercise &&
      x.sets.some((s) => s.currentBlockStartTime),
  );

  if (exerciseIndex === -1) {
    return undefined;
  }

  const exerciseWithRunningTimer = session.recordedExercises[
    exerciseIndex
  ] as RecordedCardioExercise;
  const setIndex = exerciseWithRunningTimer.sets.findIndex(
    (s) => s.currentBlockStartTime,
  );

  if (setIndex === -1) {
    return undefined;
  }

  return {
    currentBlockStartTime: toInstantJson(
      exerciseWithRunningTimer.sets[
        setIndex
      ]?.currentBlockStartTime?.toInstant(),
    ),
    currentDuration: toDurationJSON(
      exerciseWithRunningTimer.duration ?? Duration.ZERO,
    ),
    exerciseIndex,
    setIndex,
  };
}

export function getCurrentExerciseDetails(
  session: Session,
): CurrentExerciseDetails | undefined {
  return session.nextExercise
    ? {
        exercise: session.nextExercise.toJSON(),
        setIndex: session.nextExercise.currentSetIndex,
      }
    : undefined;
}

export function getTimerInfo(session: Session): RestTimerInfo | undefined {
  const lastExercise = session.lastExercise;
  const nextExercise = session.nextExercise;
  if (
    !session.restTimerStartTime ||
    !lastExercise ||
    !nextExercise ||
    !(nextExercise instanceof RecordedWeightedExercise) ||
    !(lastExercise instanceof RecordedWeightedExercise)
  ) {
    return undefined;
  }

  const repsPerSet = lastExercise.blueprint.repsPerSet;
  // Must go through Rest.orDefault, exactly as Session.restTimerEndTime does.
  // Reading restBetweenSets raw meant an exercise with no rest configured (all
  // durations zero) produced no restTimerInfo at all, so the native worker took
  // the "current exercise" branch and cancelled the rest alarms - while the
  // in-app timer, which does apply the default, happily counted down. The
  // screen-off ding could never fire for those exercises.
  const { minRest, maxRest, failureRest } = Rest.orDefault(
    lastExercise.blueprint.restBetweenSets,
  );

  const rest = match(lastExercise.lastRecordedSet)
    .with({ set: { repsCompleted: P.when((x) => x >= repsPerSet) } }, () => ({
      partialRest: minRest,
      fullRest: maxRest,
    }))
    .with({ set: { repsCompleted: P.when((x) => x < repsPerSet) } }, () => ({
      partialRest: failureRest,
      fullRest: failureRest,
    }))
    .otherwise(() => ({
      partialRest: Duration.ZERO,
      fullRest: Duration.ZERO,
    }));

  if (rest.partialRest.equals(Duration.ZERO)) {
    return;
  }
  return {
    startedAt: toInstantJson(session.restTimerStartTime.toInstant()),
    partiallyEndAt: toInstantJson(
      session.restTimerStartTime.plus(rest.partialRest).toInstant(),
    ),
    endAt: toInstantJson(
      session.restTimerStartTime.plus(rest.fullRest).toInstant(),
    ),
  };
}
