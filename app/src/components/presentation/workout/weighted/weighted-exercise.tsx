import PersonalRecordFlash, {
  personalRecordFlashDurationMs,
} from '@/components/presentation/workout/weighted/personal-record-flash';
import PotentialSetCounter from '@/components/presentation/workout/weighted/potential-set-counter';
import WeightIncreaseFloat, {
  weightIncreaseFloatDurationMs,
} from '@/components/presentation/workout/weighted/weight-increase-float';
import { weightIncreaseSinceLastTime } from '@/components/presentation/workout/weighted/weight-increase';
import { useAppTheme, spacing, font } from '@/hooks/useAppTheme';
import { RecordedWeightedExercise } from '@/models/session-models';
import { Weight } from '@/models/weight';
import { WeightedExercisePersonalBests } from '@/store/stored-sessions';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import ExerciseSection from '@/components/presentation/workout/exercise-section';
import { OffsetDateTime } from '@js-joda/core';
import { isBarbellExercise } from '@/utils/plate-math';
import PainPickerDialog from '@/components/presentation/workout/pain-picker-dialog';
import { useTranslate } from '@tolgee/react';

interface WeightedExerciseProps {
  recordedExercise: RecordedWeightedExercise;
  previousRecordedExercises: RecordedWeightedExercise[];
  toStartNext: boolean;
  isReadonly: boolean;
  showPreviousButton: boolean;
  personalBests?: WeightedExercisePersonalBests;
  backgroundColor?: string;
  painTracked?: boolean;
  painLimit?: number;
  /** Ask for pain after a set is ticked; only in the live workout */
  askPain?: boolean;

  timeProvider: () => OffsetDateTime;
  updateExercise: (ex: RecordedWeightedExercise) => void;
  onSwapExercise?: () => void;
  resetSetTimer: () => void;
  onEditExercise: () => void;
  onRemoveExercise: () => void;
}

interface PersonalRecordFlashState {
  id: number;
  setIndex: number;
  weight: Weight | undefined;
  reps: number | undefined;
}

export default function WeightedExercise(props: WeightedExerciseProps) {
  const { updateExercise, timeProvider, resetSetTimer } = props;
  const { recordedExercise } = props;
  const { colors } = useAppTheme();
  const { t } = useTranslate();
  useState(false);
  // Set index awaiting a pain score, open only right after a set is ticked
  const [painSetIndex, setPainSetIndex] = useState<number | undefined>();
  const askPainFor = (setIndex: number) => {
    if (props.painTracked && props.askPain) {
      setPainSetIndex(setIndex);
    }
  };
  // Keeps stoppedForPain in step with the sets' pain after any set change
  const withPainStop = (ex: RecordedWeightedExercise) =>
    props.painTracked && props.painLimit !== undefined
      ? ex.withPainStop(props.painLimit)
      : ex;

  const [prFlash, setPrFlash] = useState<PersonalRecordFlashState | undefined>(
    undefined,
  );
  // Reps the user entered for sets that are currently unchecked, keyed by set
  // index. Lets an uncheck/recheck restore the entered value instead of
  // resetting to the blueprint target, which would discard the user's edit.
  const [pendingReps, setPendingReps] = useState<
    Partial<Record<number, number>>
  >({});
  const clearPendingReps = (setIndex: number) =>
    setPendingReps((pending) => {
      const { [setIndex]: _cleared, ...rest } = pending;
      return rest;
    });
  const prFlashTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(prFlashTimeout.current), []);
  const [weightFloat, setWeightFloat] = useState<
    { id: number; setIndex: number; increase: Weight } | undefined
  >();
  const weightFloatTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(weightFloatTimeout.current), []);

  const showWeightIncrease = (setIndex: number, increase: Weight) => {
    setWeightFloat((previous) => ({
      id: (previous?.id ?? 0) + 1,
      setIndex,
      increase,
    }));
    clearTimeout(weightFloatTimeout.current);
    weightFloatTimeout.current = setTimeout(
      () => setWeightFloat(undefined),
      weightIncreaseFloatDurationMs,
    );
  };

  const checkForPersonalRecord = (
    exercise: RecordedWeightedExercise,
    setIndex: number,
  ) => {
    const bests = props.personalBests;
    if (!bests) {
      // Never recorded this exercise before - nothing to beat
      return;
    }
    const completedSet = exercise.getSet(setIndex);
    const reps = completedSet.set?.repsCompleted;
    if (!reps) {
      return;
    }

    // Sets already completed this session also count towards the record to
    // beat, so a record only flashes once per new best
    let maxWeight = bests.maxWeight;
    let maxReps = bests.maxReps;
    exercise.potentialSets.forEach((otherSet, otherIndex) => {
      const otherReps = otherSet.set?.repsCompleted;
      if (otherIndex === setIndex || !otherReps) {
        return;
      }
      if (!maxWeight || otherSet.weight.isGreaterThan(maxWeight)) {
        maxWeight = otherSet.weight;
      }
      if (!maxReps || otherReps > maxReps) {
        maxReps = otherReps;
      }
    });

    const weightRecord =
      maxWeight && completedSet.weight.isGreaterThan(maxWeight)
        ? completedSet.weight
        : undefined;
    const repsRecord = maxReps && reps > maxReps ? reps : undefined;
    if (!weightRecord && repsRecord === undefined) {
      return;
    }

    setPrFlash((previous) => ({
      id: (previous?.id ?? 0) + 1,
      setIndex,
      weight: weightRecord,
      reps: repsRecord,
    }));
    clearTimeout(prFlashTimeout.current);
    prFlashTimeout.current = setTimeout(
      () => setPrFlash(undefined),
      personalRecordFlashDurationMs,
    );
  };

  const setToStartNext = recordedExercise.potentialSets.findIndex(
    (x) => !x.set,
  );

  const isBarbell = isBarbellExercise(recordedExercise.blueprint.name);

  const stoppedAt =
    props.painTracked && props.painLimit !== undefined
      ? recordedExercise.stoppedForPainAt(props.painLimit)
      : undefined;
  const isSetLocked = (setIndex: number) =>
    props.isReadonly ||
    (stoppedAt !== undefined &&
      recordedExercise.isSetLockedForPain(setIndex, props.painLimit!));

  const headerStyle = {
    color: colors.onSurfaceVariant,
    ...font['text-sm'],
    textTransform: 'uppercase' as const,
  };

  return (
    <ExerciseSection
      recordedExercise={props.recordedExercise}
      previousRecordedExercises={props.previousRecordedExercises}
      toStartNext={props.toStartNext}
      isReadonly={props.isReadonly}
      showPreviousButton={props.showPreviousButton}
      backgroundColor={props.backgroundColor}
      updateExercise={props.updateExercise}
      onEditExercise={props.onEditExercise}
      onRemoveExercise={props.onRemoveExercise}
      onSwapExercise={props.onSwapExercise}
    >
      <View style={{ flexDirection: 'column' }}>
        {stoppedAt !== undefined ? (
          <Text
            style={{
              color: colors.error,
              ...font['text-sm'],
              paddingBottom: spacing[1],
              paddingHorizontal: spacing[1],
            }}
          >
            {t('injury.pain.stopped')}
          </Text>
        ) : null}
        {/* Column headers */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingBottom: spacing[1],
            paddingHorizontal: spacing[1],
          }}
        >
          <View style={{ width: 44, alignItems: 'center' }}>
            <Text style={headerStyle}>SET</Text>
          </View>
          <View style={{ flex: 1.5 }}>
            <Text style={headerStyle}>PREVIOUS</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={headerStyle}>KG</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={headerStyle}>REPS</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {recordedExercise.potentialSets.map((set, index) => (
          <View key={index}>
            <PotentialSetCounter
              isReadonly={isSetLocked(index)}
              isBarbell={isBarbell}
              weightAbove={recordedExercise.potentialSets[index - 1]?.weight}
              setIndex={index}
              maxReps={recordedExercise.blueprint.repsPerSet}
              pendingReps={pendingReps[index]}
              onComplete={(reps) => {
                const newExercise = recordedExercise.withRepCount(
                  index,
                  reps,
                  timeProvider(),
                );
                clearPendingReps(index);
                updateExercise(newExercise);
                checkForPersonalRecord(newExercise, index);
                resetSetTimer();
                askPainFor(index);
              }}
              onUncheck={() => {
                const reps = set.set?.repsCompleted;
                if (reps !== undefined) {
                  setPendingReps((pending) => ({ ...pending, [index]: reps }));
                }
                updateExercise(
                  withPainStop(
                    recordedExercise.withRepCount(
                      index,
                      undefined,
                      timeProvider(),
                    ),
                  ),
                );
                resetSetTimer();
              }}
              previousSet={
                props.previousRecordedExercises.at(0)?.potentialSets[index]
              }
              onUpdateReps={(reps) => {
                const previousReps = set.set?.repsCompleted;
                const newExercise = recordedExercise.withRepCount(
                  index,
                  reps,
                  timeProvider(),
                );
                clearPendingReps(index);
                updateExercise(withPainStop(newExercise));
                if (
                  reps !== undefined &&
                  (previousReps === undefined || reps > previousReps)
                ) {
                  checkForPersonalRecord(newExercise, index);
                }
                resetSetTimer();
                if (previousReps === undefined && reps !== undefined) {
                  askPainFor(index);
                }
              }}
              onUpdateWeight={(w, applyTo) => {
                updateExercise(recordedExercise.withWeight(index, w, applyTo));
                const lastTime =
                  props.previousRecordedExercises.at(0)?.potentialSets[index];
                const increase = weightIncreaseSinceLastTime({
                  saved: w,
                  before: set.weight,
                  lastTime: lastTime?.set ? lastTime.weight : undefined,
                });
                if (increase) {
                  showWeightIncrease(index, increase);
                }
              }}
              set={set}
              toStartNext={
                props.toStartNext &&
                setToStartNext === index &&
                !isSetLocked(index)
              }
              weightIncrement={
                recordedExercise.blueprint.progressiveOverload.weightIncrement
              }
            />
            {weightFloat?.setIndex === index ? (
              <WeightIncreaseFloat
                key={weightFloat.id}
                increase={weightFloat.increase}
              />
            ) : null}
            {prFlash?.setIndex === index ? (
              <PersonalRecordFlash
                key={prFlash.id}
                weight={prFlash.weight}
                reps={prFlash.reps}
              />
            ) : null}
          </View>
        ))}
      </View>
      <PainPickerDialog
        visible={painSetIndex !== undefined}
        onPick={(pain) => {
          if (painSetIndex !== undefined) {
            updateExercise(
              withPainStop(recordedExercise.withSetPain(painSetIndex, pain)),
            );
          }
          setPainSetIndex(undefined);
        }}
        onSkip={() => setPainSetIndex(undefined)}
      />
    </ExerciseSection>
  );
}
