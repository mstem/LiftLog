import { PotentialSet, WeightAppliesTo } from '@/models/session-models';
import BigNumber from 'bignumber.js';
import { useEffect, useState } from 'react';
import { Text as PaperText, Chip } from 'react-native-paper';
import { Keyboard, Text, View } from 'react-native';
import WeightFormat from '@/components/presentation/foundation/weight-format';
import WeightDialog from '@/components/presentation/foundation/editors/weight-dialog';
import { useAppTheme, spacing, font, rounding } from '@/hooks/useAppTheme';
import { T } from '@tolgee/react';
import TouchableRipple from '@/components/presentation/foundation/gesture-wrappers/touchable-ripple';
import { Weight } from '@/models/weight';
import PotentialSetAdditionalActionsDialog from '@/components/presentation/workout/weighted/potential-sets-addition-actions-dialog';
import IconButton from '@/components/presentation/foundation/gesture-wrappers/icon-button';
import {
  formatPlateBreakdown,
  getPlateBreakdown,
} from '@/utils/plate-math';

interface PotentialSetCounterProps {
  set: PotentialSet;
  setIndex: number;
  weightIncrement: BigNumber;
  maxReps: number;
  previousSet: PotentialSet | undefined;
  toStartNext: boolean;
  isReadonly: boolean;
  isBarbell: boolean;
  // Weight of the set directly above this one in the exercise, if any. Used to
  // only repeat the barbell plate breakdown when the weight changes.
  weightAbove: Weight | undefined;

  onTap: () => void;
  onUpdateWeight: (weight: Weight, applyTo: WeightAppliesTo) => void;
  onUpdateReps: (reps: number | undefined) => void;
}

export default function PotentialSetCounter(props: PotentialSetCounterProps) {
  const { colors, colorScheme } = useAppTheme();
  const [isWeightDialogOpen, setIsWeightDialogOpen] = useState(false);
  const [isRepsDialogOpen, setIsRepsDialogOpen] = useState(false);
  const repCountValue = props.set?.set?.repsCompleted;
  const isComplete = repCountValue !== undefined;

  // If last time this set hit (or beat) the rep target, the weight is a
  // candidate for increasing - unless it has already been bumped since then.
  const previousReps = props.previousSet?.set?.repsCompleted;
  const hitRepTargetLastTime =
    previousReps !== undefined && previousReps >= props.maxReps;
  const weightNotYetIncreased = props.previousSet
    ? !props.set.weight.isGreaterThan(props.previousSet.weight)
    : false;
  // Bodyweight / band movements (Inverted Row, Pull Up, band work) are tracked
  // at 0kg - "add weight" isn't how you progress them, so never suggest it.
  const isWeighted = !props.set.weight.value.isZero();
  const isIncreaseCandidate =
    isWeighted &&
    hitRepTargetLastTime &&
    weightNotYetIncreased &&
    !isComplete &&
    !props.isReadonly;
  // A true yellow highlight. We can't use theme colours here: colorPair()
  // harmonizes every colour toward the (green) seed, which turns yellow/amber
  // olive. Pick a readable yellow per theme instead.
  const increaseCandidateBg =
    colorScheme === 'dark'
      ? 'rgba(253, 224, 71, 0.15)'
      : 'rgba(250, 204, 21, 0.39)';
  // Only show the plate breakdown on the first set, or when the weight differs
  // from the set above - so a run of same-weight sets isn't repetitive.
  const weightChangedFromAbove =
    !props.weightAbove || !props.set.weight.equals(props.weightAbove, true);
  const plateBreakdown =
    props.isBarbell && weightChangedFromAbove
      ? getPlateBreakdown(props.set.weight)
      : undefined;
  const plateText = plateBreakdown
    ? formatPlateBreakdown(plateBreakdown)
    : undefined;

  useEffect(() => {
    if (!isRepsDialogOpen) {
      Keyboard.dismiss();
    }
  }, [isRepsDialogOpen]);
  const [applyTo, setApplyTo] = useState<WeightAppliesTo>('uncompletedSets');

  const handleCheckmark = () => {
    if (isComplete) {
      props.onUpdateReps(undefined);
    } else {
      props.onTap();
    }
  };

  const cellStyle = {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[1],
    borderRadius: rounding.roundedRectangleRadius,
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: rounding.roundedRectangleRadius,
        backgroundColor: isComplete
          ? colors.primary + '18'
          : props.toStartNext
          ? colors.secondaryContainer + '50'
          : props.setIndex % 2 === 1
          ? colors.onSurface + '0D'
          : 'transparent',
      }}
    >
      {/* SET number */}
      <View style={{ width: 44, alignItems: 'center' }}>
        <Text
          style={{
            color: isComplete ? colors.primary : colors.onSurfaceVariant,
            fontWeight: 'bold',
            ...font['text-base'],
          }}
        >
          {props.setIndex + 1}
        </Text>
      </View>

      {/* PREVIOUS */}
      <View
        style={{
          flex: 1.5,
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {props.previousSet?.set ? (
          <>
            <WeightFormat
              weight={props.previousSet.weight}
              fontSize="text-sm"
              color="onSurfaceVariant"
            />
            <Text
              style={{ color: colors.onSurfaceVariant, ...font['text-sm'] }}
            >
              {' × '}
              {props.previousSet.set.repsCompleted}
            </Text>
          </>
        ) : (
          <Text style={{ color: colors.onSurfaceVariant, ...font['text-sm'] }}>
            -
          </Text>
        )}
      </View>

      {/* WEIGHT */}
      <TouchableRipple
        testID="repcount-weight"
        style={[
          cellStyle,
          {
            flex: 1,
            alignItems: 'center',
            backgroundColor: isIncreaseCandidate
              ? increaseCandidateBg
              : undefined,
          },
        ]}
        onPress={
          props.isReadonly
            ? undefined
            : () => {
                setApplyTo(props.set.set ? 'thisSet' : 'uncompletedSets');
                setIsWeightDialogOpen(true);
              }
        }
        disabled={props.isReadonly}
      >
        <View style={{ alignItems: 'center' }}>
          <WeightFormat
            weight={props.set.weight}
            fontSize="text-base"
            color={isComplete ? 'primary' : 'onSurface'}
            fontWeight="600"
          />
          {plateText ? (
            <Text
              style={{
                color: colors.onSurfaceVariant,
                ...font['text-xs'],
                textAlign: 'center',
              }}
            >
              {plateText}
            </Text>
          ) : null}
        </View>
      </TouchableRipple>

      {/* REPS */}
      <TouchableRipple
        testID="repcount"
        style={[cellStyle, { flex: 1, alignItems: 'center' }]}
        onPress={
          props.isReadonly ? undefined : () => setIsRepsDialogOpen(true)
        }
        disabled={props.isReadonly}
      >
        <Text
          style={{
            color: isComplete ? colors.primary : colors.onSurface,
            fontWeight: '600',
            ...font['text-base'],
          }}
        >
          {repCountValue ??
            (props.previousSet?.set?.repsCompleted ?? props.maxReps)}
        </Text>
      </TouchableRipple>

      {/* Checkmark */}
      {!props.isReadonly ? (
        <IconButton
          icon={isComplete ? 'checkBox' : 'checkBoxOutlineBlank'}
          iconColor={isComplete ? colors.primary : colors.onSurfaceVariant}
          onPress={handleCheckmark}
          style={{ margin: 0, width: 40 }}
        />
      ) : (
        <View style={{ width: 40 }} />
      )}

      <WeightDialog
        open={isWeightDialogOpen}
        allowNegative
        increment={props.weightIncrement}
        weight={props.set.weight}
        onClose={() => setIsWeightDialogOpen(false)}
        updateWeight={(w) => props.onUpdateWeight(w, applyTo)}
      >
        <View style={{ gap: spacing[2] }}>
          <PaperText variant="labelLarge">
            <T keyName="weight.apply_to.label" />
          </PaperText>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: spacing[1],
            }}
          >
            <Chip
              selected={applyTo === 'thisSet'}
              testID="repcount-apply-weight-to-this-set"
              onPress={() => setApplyTo('thisSet')}
            >
              <T keyName="exercise.this_set.label" />
            </Chip>
            <Chip
              selected={applyTo === 'uncompletedSets'}
              testID="repcount-apply-weight-to-uncompleted-sets"
              onPress={() => setApplyTo('uncompletedSets')}
            >
              <T keyName="exercise.uncompleted_sets.label" />
            </Chip>
            <Chip
              selected={applyTo === 'allSets'}
              testID="repcount-apply-weight-to-all-sets"
              onPress={() => setApplyTo('allSets')}
            >
              <T keyName="exercise.all_sets.label" />
            </Chip>
          </View>
        </View>
      </WeightDialog>

      <PotentialSetAdditionalActionsDialog
        open={isRepsDialogOpen}
        repTarget={props.maxReps}
        set={props.set}
        updateRepCount={(reps) => props.onUpdateReps(reps)}
        close={() => setIsRepsDialogOpen(false)}
      />
    </View>
  );
}
