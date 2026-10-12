import FullHeightScrollView from '@/components/layout/full-height-scroll-view';
import ConfirmationDialog from '@/components/presentation/foundation/confirmation-dialog';
import { usePreventNavigate } from '@/hooks/usePreventNavigate';
import Button from '@/components/presentation/foundation/gesture-wrappers/button';
import IconButton from '@/components/presentation/foundation/gesture-wrappers/icon-button';
import { spacing } from '@/hooks/useAppTheme';
import { NormalizedName } from '@/models/blueprint-models';
import { isShoulderLoaded } from '@/models/injury/flags';
import { Injury } from '@/models/injury/injury';
import { RootState, useAppSelector } from '@/store';
import { showSnackbar } from '@/store/app';
import { setFlagOverride, setInjury } from '@/store/injury';
import { selectActiveProgram } from '@/store/program';
import { LocalDate } from '@js-joda/core';
import { T, useTranslate } from '@tolgee/react';
import { Stack, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  Chip,
  HelperText,
  List,
  SegmentedButtons,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';
import { DatePickerInput } from 'react-native-paper-dates';
import { useDispatch } from 'react-redux';

function Stepper(props: {
  label: string;
  display: string;
  onDecrement: () => void;
  onIncrement: () => void;
  decrementDisabled: boolean;
  incrementDisabled: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Text variant="labelLarge">{props.label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconButton
          icon="minus"
          disabled={props.decrementDisabled}
          onPress={props.onDecrement}
        />
        <Text
          variant="titleMedium"
          style={{ minWidth: 48, textAlign: 'center' }}
        >
          {props.display}
        </Text>
        <IconButton
          icon="plus"
          disabled={props.incrementDisabled}
          onPress={props.onIncrement}
        />
      </View>
    </View>
  );
}

function InjuryForm({ injury }: { injury: Injury }) {
  const { t } = useTranslate();
  const dispatch = useDispatch();
  const { push, back } = useRouter();
  const navigation = useNavigation();
  const [draft, setDraft] = useState(injury);
  const [newStructure, setNewStructure] = useState('');
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const saveBlocked = useAppSelector(
    (state: RootState) => state.injury.saveBlocked,
  );

  useEffect(() => setDraft(injury), [injury]);

  const onsetDate = LocalDate.parse(draft.onsetDate);
  const onset = new Date(
    onsetDate.year(),
    onsetDate.monthValue() - 1,
    onsetDate.dayOfMonth(),
  );
  const onsetInFuture = onsetDate.isAfter(LocalDate.now());
  const tenths = Math.round(draft.firstCut * 10);

  const addStructure = () => {
    const value = newStructure.trim().toLowerCase();
    if (value && !draft.structures.includes(value)) {
      setDraft({ ...draft, structures: [...draft.structures, value] });
    }
    setNewStructure('');
  };

  const pending = newStructure.trim().toLowerCase();
  const edited: Injury = {
    ...draft,
    name: draft.name.trim(),
    structures:
      pending && !draft.structures.includes(pending)
        ? [...draft.structures, pending]
        : draft.structures,
  };
  const isValid = edited.name !== '' && !onsetInFuture;
  const isDirty = JSON.stringify(edited) !== JSON.stringify(injury);

  const save = () => {
    dispatch(setInjury(edited));
    setNewStructure('');
  };

  // A blocked save shows its own message from the persist effect.
  const saveAndConfirm = () => {
    save();
    if (!saveBlocked) {
      dispatch(showSnackbar({ text: t('injury.saved') }));
    }
  };

  // Leaving saves valid edits. Invalid ones ask before they are thrown away.
  const latest = useRef({ isDirty, isValid, edited });
  latest.current = { isDirty, isValid, edited };
  useEffect(
    () =>
      navigation.addListener('beforeRemove', () => {
        const { isDirty, isValid, edited } = latest.current;
        if (isDirty && isValid) {
          dispatch(setInjury(edited));
        }
      }),
    [navigation, dispatch],
  );
  usePreventNavigate(isDirty && !isValid && !discarding, () =>
    setLeaveOpen(true),
  );
  useEffect(() => {
    if (discarding) {
      back();
    }
  }, [discarding, back]);

  const markResolved = () =>
    dispatch(setInjury({ ...(isValid ? edited : injury), status: 'resolved' }));

  const rerunScreen = () => {
    if (isDirty) {
      save();
    }
    push('/settings/injury/screen');
  };

  return (
    <View style={{ padding: spacing.pageHorizontalMargin, gap: spacing[4] }}>
      <TextInput
        mode="outlined"
        label={t('injury.name')}
        value={draft.name}
        onChangeText={(name) => setDraft({ ...draft, name })}
      />
      <SegmentedButtons
        value={draft.side}
        onValueChange={(side) => setDraft({ ...draft, side })}
        buttons={[
          { value: 'left', label: t('injury.side.left') },
          { value: 'right', label: t('injury.side.right') },
        ]}
      />
      <View>
        <DatePickerInput
          locale="default"
          inputMode="start"
          label={t('injury.onset')}
          value={onset}
          onChange={(e) => {
            if (e) {
              setDraft({
                ...draft,
                onsetDate: LocalDate.of(
                  e.getFullYear(),
                  e.getMonth() + 1,
                  e.getDate(),
                ).toString(),
              });
            }
          }}
        />
        <HelperText type="error" visible={onsetInFuture}>
          {t('injury.onset.future')}
        </HelperText>
      </View>
      <View style={{ gap: spacing[2] }}>
        <Text variant="labelLarge">
          <T keyName="injury.structures" />
        </Text>
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}
        >
          {draft.structures.map((s) => (
            <Chip
              key={s}
              mode="outlined"
              onClose={() =>
                setDraft({
                  ...draft,
                  structures: draft.structures.filter((x) => x !== s),
                })
              }
            >
              {s}
            </Chip>
          ))}
        </View>
        <TextInput
          mode="outlined"
          dense
          label={t('injury.structures.add')}
          value={newStructure}
          onChangeText={setNewStructure}
          onSubmitEditing={addStructure}
          right={<TextInput.Icon icon="plus" onPress={addStructure} />}
        />
      </View>
      <Stepper
        label={t('injury.pain_limit')}
        display={`${draft.painLimit}`}
        decrementDisabled={draft.painLimit <= 1}
        incrementDisabled={draft.painLimit >= 10}
        onDecrement={() =>
          setDraft({ ...draft, painLimit: Math.max(1, draft.painLimit - 1) })
        }
        onIncrement={() =>
          setDraft({ ...draft, painLimit: Math.min(10, draft.painLimit + 1) })
        }
      />
      <Stepper
        label={t('injury.first_cut')}
        display={`${tenths * 10}%`}
        decrementDisabled={tenths <= 1}
        incrementDisabled={tenths >= 9}
        onDecrement={() =>
          setDraft({ ...draft, firstCut: Math.max(1, tenths - 1) / 10 })
        }
        onIncrement={() =>
          setDraft({ ...draft, firstCut: Math.min(9, tenths + 1) / 10 })
        }
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="labelLarge">
          <T keyName="injury.status.label" />
        </Text>
        <Text variant="bodyLarge">
          {injury.status === 'active'
            ? t('injury.status.active')
            : t('injury.status.resolved')}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
        <Button
          mode="contained"
          disabled={!isValid || !isDirty}
          onPress={saveAndConfirm}
        >
          <T keyName="generic.save.button" />
        </Button>
        {injury.status === 'active' ? (
          <>
            <Button mode="outlined" disabled={!isValid} onPress={rerunScreen}>
              <T keyName="injury.rerun_screen" />
            </Button>
            <Button mode="outlined" onPress={markResolved}>
              <T keyName="injury.mark_resolved" />
            </Button>
          </>
        ) : (
          <Button
            mode="outlined"
            onPress={() => push('/settings/injury/screen')}
          >
            <T keyName="injury.start" />
          </Button>
        )}
      </View>
      <ConfirmationDialog
        open={leaveOpen}
        headline={t('injury.leave.confirm.title')}
        textContent={t('injury.leave.confirm.body')}
        okText={t('injury.leave.confirm.discard.button')}
        onCancel={() => setLeaveOpen(false)}
        onOk={() => {
          setLeaveOpen(false);
          setDiscarding(true);
        }}
      />
    </View>
  );
}

function ShoulderFlags() {
  const dispatch = useDispatch();
  const program = useAppSelector(selectActiveProgram);
  const overrides = useAppSelector(
    (state: RootState) => state.injury.flagOverrides,
  );
  const names = useMemo(() => {
    const seen = new Map<string, string>();
    for (const session of program.sessions) {
      for (const exercise of session.exercises) {
        if (exercise.type !== 'WeightedExerciseBlueprint') continue;
        const key = new NormalizedName(exercise.name).toString();
        if (!seen.has(key)) seen.set(key, exercise.name);
      }
    }
    return [...seen.values()];
  }, [program]);

  return (
    <List.Section>
      <List.Subheader>
        <T keyName="injury.flags.title" />
      </List.Subheader>
      {names.map((name) => {
        const key = new NormalizedName(name).toString();
        return (
          <List.Item
            key={key}
            title={name}
            onLongPress={() =>
              dispatch(setFlagOverride({ name: key, flagged: undefined }))
            }
            right={() => (
              <Switch
                value={isShoulderLoaded(name, overrides)}
                onValueChange={(flagged) => {
                  dispatch(setFlagOverride({ name: key, flagged }));
                }}
              />
            )}
          />
        );
      })}
    </List.Section>
  );
}

export default function InjurySettings() {
  const { t } = useTranslate();
  const { push } = useRouter();
  const injury = useAppSelector((state: RootState) => state.injury.injury);

  return (
    <FullHeightScrollView>
      <Stack.Screen options={{ title: t('injury.title') }} />
      {injury ? (
        <>
          <InjuryForm injury={injury} />
          <ShoulderFlags />
        </>
      ) : (
        <View style={{ padding: spacing.pageHorizontalMargin }}>
          <View style={{ flexDirection: 'row' }}>
            <Button
              mode="contained"
              onPress={() => push('/settings/injury/screen')}
            >
              <T keyName="injury.start" />
            </Button>
          </View>
        </View>
      )}
    </FullHeightScrollView>
  );
}
