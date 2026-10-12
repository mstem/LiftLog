import FullHeightScrollView from '@/components/layout/full-height-scroll-view';
import Button from '@/components/presentation/foundation/gesture-wrappers/button';
import { spacing } from '@/hooks/useAppTheme';
import {
  defaultFirstCut,
  defaultPainLimit,
  Injury,
  InjurySide,
  ScreenFindings,
  shoulderInjurySlug,
} from '@/models/injury/injury';
import { screenOutcome } from '@/models/injury/screen';
import { RootState, useAppSelector } from '@/store';
import { setInjury } from '@/store/injury';
import { LocalDate, OffsetDateTime } from '@js-joda/core';
import { T, useTranslate } from '@tolgee/react';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Chip, RadioButton, SegmentedButtons, Text } from 'react-native-paper';
import { useDispatch } from 'react-redux';

type Answer = 'yes' | 'no' | 'unsure';

const questions = [
  { key: 'traumaWithWeakness', text: 'injury.screen.trauma' },
  { key: 'feverOrHotJoint', text: 'injury.screen.fever' },
  { key: 'painfulArc', text: 'injury.screen.painful_arc' },
  { key: 'dropArm', text: 'injury.screen.drop_arm' },
  { key: 'passiveAsLimitedAsActive', text: 'injury.screen.passive' },
  { key: 'neckSymptoms', text: 'injury.screen.neck' },
  { key: 'scapularSymptoms', text: 'injury.screen.scapular' },
] as const;

type QuestionKey = (typeof questions)[number]['key'];

const redFlagKeys: QuestionKey[] = ['traumaWithWeakness', 'feverOrHotJoint'];

const toOptional = (a: Answer | undefined): boolean | undefined =>
  a === 'yes' ? true : a === 'no' ? false : undefined;

// An unsure red flag is treated as present: the cautious reading.
const toRedFlag = (a: Answer | undefined): boolean => a !== 'no';

export default function InjurySelfScreen() {
  const { t } = useTranslate();
  const dispatch = useDispatch();
  const { dismissTo } = useRouter();
  const stored = useAppSelector((state: RootState) => state.injury.injury);
  // A re-run updates the active injury. With none active (never started, or
  // resolved) the screen starts a fresh one in its place.
  const active = stored?.status === 'active' ? stored : undefined;

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<QuestionKey, Answer>>>(
    {},
  );
  const [structures, setStructures] = useState<string[] | undefined>();
  // A fresh injury asks for the side; nothing about the user is preset.
  const [side, setSide] = useState<InjurySide | undefined>();

  const isResult = step >= questions.length;
  const question = questions[step];

  const outcome = isResult
    ? screenOutcome({
        traumaWithWeakness: toRedFlag(answers.traumaWithWeakness),
        feverOrHotJoint: toRedFlag(answers.feverOrHotJoint),
        painfulArc: toOptional(answers.painfulArc),
        dropArm: toOptional(answers.dropArm),
        passiveAsLimitedAsActive: toOptional(answers.passiveAsLimitedAsActive),
        neckSymptoms: toOptional(answers.neckSymptoms),
        scapularSymptoms: toOptional(answers.scapularSymptoms),
      })
    : undefined;

  const suggested =
    outcome && outcome.kind !== 'clinician' ? outcome.suggestedStructures : [];
  const allStructures = [
    ...new Set([...(active?.structures ?? []), ...suggested]),
  ];
  const selected = structures ?? allStructures;

  const start = () => {
    const today = LocalDate.now().toString();
    const findings: ScreenFindings = {
      redFlags: redFlagKeys.some((k) => toRedFlag(answers[k])),
      painfulArc: toOptional(answers.painfulArc),
      dropArm: toOptional(answers.dropArm),
      passiveAsLimitedAsActive: toOptional(answers.passiveAsLimitedAsActive),
      neckSymptoms: toOptional(answers.neckSymptoms),
      scapularSymptoms: toOptional(answers.scapularSymptoms),
      takenOn: today,
    };
    if (!active && !side) return;
    const injury: Injury = active
      ? { ...active, structures: selected, screenFindings: findings }
      : {
          slug: shoulderInjurySlug,
          name: t('injury.name.default'),
          side: side!,
          onsetDate: today,
          structures: selected,
          painLimit: defaultPainLimit,
          firstCut: defaultFirstCut,
          status: 'active',
          screenFindings: findings,
          // Work logged before the mode is on is not injury-era history.
          trackedFrom: OffsetDateTime.now().toString(),
        };
    dispatch(setInjury(injury));
    dismissTo('/settings/injury');
  };

  const toggleStructure = (s: string) =>
    setStructures(
      selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s],
    );

  return (
    <FullHeightScrollView>
      <Stack.Screen options={{ title: t('injury.title') }} />
      <View
        style={{
          padding: spacing.pageHorizontalMargin,
          gap: spacing[4],
        }}
      >
        {question ? (
          <>
            <Text variant="titleMedium">
              <T keyName={question.text} />
            </Text>
            <RadioButton.Group
              value={answers[question.key] ?? ''}
              onValueChange={(value) =>
                setAnswers({ ...answers, [question.key]: value as Answer })
              }
            >
              <RadioButton.Item label={t('generic.yes.button')} value="yes" />
              <RadioButton.Item label={t('generic.no.button')} value="no" />
              <RadioButton.Item label={t('injury.not_sure')} value="unsure" />
            </RadioButton.Group>
            {/* Next comes first so it stays in the same place on every page. */}
            <View style={{ flexDirection: 'row', gap: spacing[2] }}>
              <Button
                mode="contained"
                disabled={answers[question.key] === undefined}
                onPress={() => setStep(step + 1)}
              >
                <T keyName="generic.next.button" />
              </Button>
              {step > 0 && (
                <Button mode="outlined" onPress={() => setStep(step - 1)}>
                  <T keyName="generic.back.button" />
                </Button>
              )}
            </View>
          </>
        ) : outcome?.kind === 'clinician' ? (
          <>
            <Text variant="bodyLarge">
              <T keyName="injury.clinician.body" />
            </Text>
            {active && (
              <Text variant="bodyLarge">
                <T keyName="injury.clinician.still_on" />
              </Text>
            )}
            <View style={{ flexDirection: 'row' }}>
              <Button
                mode="contained"
                onPress={() => dismissTo('/settings/injury')}
              >
                <T keyName="generic.close.button" />
              </Button>
            </View>
          </>
        ) : (
          <>
            {outcome?.kind === 'physio' && (
              <Text variant="bodyLarge">
                <T keyName="injury.physio.body" />
              </Text>
            )}
            {allStructures.length > 0 && (
              <View style={{ gap: spacing[2] }}>
                <Text variant="labelLarge">
                  <T keyName="injury.structures" />
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: spacing[2],
                  }}
                >
                  {allStructures.map((s) => (
                    <Chip
                      key={s}
                      mode="outlined"
                      selected={selected.includes(s)}
                      onPress={() => toggleStructure(s)}
                    >
                      {s}
                    </Chip>
                  ))}
                </View>
              </View>
            )}
            {!active && (
              <View style={{ gap: spacing[2] }}>
                <Text variant="labelLarge">
                  <T keyName="injury.side" />
                </Text>
                <SegmentedButtons
                  value={side ?? ''}
                  onValueChange={(v) => setSide(v as InjurySide)}
                  buttons={[
                    { value: 'left', label: t('injury.side.left') },
                    { value: 'right', label: t('injury.side.right') },
                  ]}
                />
              </View>
            )}
            <View style={{ flexDirection: 'row' }}>
              <Button
                mode="contained"
                disabled={!active && !side}
                onPress={start}
              >
                {outcome?.kind === 'physio' ? (
                  <T keyName="injury.physio.continue" />
                ) : (
                  <T keyName="generic.start.button" />
                )}
              </Button>
            </View>
          </>
        )}
        <Text variant="bodySmall">
          <T keyName="injury.disclaimer" />
        </Text>
      </View>
    </FullHeightScrollView>
  );
}
