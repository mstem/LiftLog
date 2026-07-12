import PersonalRecordFlash, {
  personalRecordFlashDurationMs,
} from '@/components/presentation/workout/weighted/personal-record-flash';
import PotentialSetCounter from '@/components/presentation/workout/weighted/potential-set-counter';
import { useAppTheme, spacing, font } from '@/hooks/useAppTheme';
import { RecordedWeightedExercise } from '@/models/session-models';
import { Weight } from '@/models/weight';
import { WeightedExercisePersonalBests } from '@/store/stored-sessions';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import ExerciseSection from '@/components/presentation/workout/exercise-section';
import { OffsetDateTime } from '@js-joda/core';
import { isBarbellExercise } from '@/utils/plate-math';

interface WeightedExerciseProps {
  recordedExercise: RecordedWeightedExercise;
  previousRecordedExercises: RecordedWeightedExercise[];
  toStartNext: boolean;
  isReadonly: boolean;
  showPreviousButton: boolean;
  personalBests?: WeightedExercisePersonalBests;

  timeProvider: () => OffsetDateTime;
  updateExercise: (ex: RecordedWeightedExercise) => void;
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
  useState(false);

  const [prFlash, setPrFlash] = useState<PersonalRecordFlashState | undefined>(
    undefined,
  );
  const prFlashTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(prFlashTimeout.current), []);

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
      updateExercise={props.updateExercise}
      onEditExercise={props.onEditExercise}
      onRemoveExercise={props.onRemoveExercise}
    >
      <View style={{ flexDirection: 'column' }}>
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
              isReadonly={props.isReadonly}
              isBarbell={isBarbell}
              weightAbove={
                recordedExercise.potentialSets[index - 1]?.weight
              }
              setIndex={index}
              maxReps={recordedExercise.blueprint.repsPerSet}
              onTap={() => {
                const previousSet = set.set;
                const newExercise = recordedExercise.withCycledRepCount(
                  index,
                  timeProvider(),
                );
                const newSet = newExercise.getSet(index).set;
                updateExercise(newExercise);
                if (!previousSet && newSet) {
                  checkForPersonalRecord(newExercise, index);
                }
                if (!previousSet || !newSet) {
                  resetSetTimer();
                }
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
                updateExercise(newExercise);
                if (
                  reps !== undefined &&
                  (previousReps === undefined || reps > previousReps)
                ) {
                  checkForPersonalRecord(newExercise, index);
                }
                resetSetTimer();
              }}
              onUpdateWeight={(w, applyTo) =>
                updateExercise(recordedExercise.withWeight(index, w, applyTo))
              }
              set={set}
              toStartNext={
                props.toStartNext &&
                setToStartNext === index &&
                !props.isReadonly
              }
              weightIncrement={
                recordedExercise.blueprint.progressiveOverload.weightIncrement
              }
            />
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
    </ExerciseSection>
  );
}
