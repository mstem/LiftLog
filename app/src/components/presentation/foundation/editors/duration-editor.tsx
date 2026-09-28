import { useAppTheme, spacing, font } from '@/hooks/useAppTheme';
import { Duration } from '@js-joda/core';
import { useDurationFields } from '@/components/presentation/foundation/editors/use-duration-fields';
import { Text, View } from 'react-native';
import { TextInput } from 'react-native-paper';

interface DurationEditorProps {
  label?: string;
  duration: Duration;
  showHours?: boolean;
  onDurationUpdated: (rest: Duration) => void;
  readonly?: boolean;
}

export default function DurationEditor(props: DurationEditorProps) {
  const { colors } = useAppTheme();
  const { duration, onDurationUpdated, readonly } = props;

  const {
    hours,
    minutes,
    seconds,
    updateHours,
    updateMinutes,
    updateSeconds,
    resetValues,
  } = useDurationFields(duration, onDurationUpdated, readonly);

  return (
    <>
      {props.label && (
        <Text
          style={{
            ...font['text-lg'],
            color: colors.onSurface,
            textAlign: 'center',
          }}
        >
          {props.label}
        </Text>
      )}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          gap: spacing[2],
        }}
      >
        {props.showHours ? (
          <>
            <TextInput
              mode="outlined"
              inputMode="numeric"
              readOnly={readonly}
              submitBehavior="blurAndSubmit"
              returnKeyType="done"
              style={{ width: spacing[24], textAlign: 'center' }}
              value={hours}
              onChangeText={updateHours}
              onBlur={resetValues}
              right={<TextInput.Affix text="h" />}
            />
            <Text
              style={{
                alignSelf: 'center',
                ...font['text-xl'],
                fontWeight: 'bold',
                color: colors.onSecondaryContainer,
              }}
            >
              :
            </Text>
          </>
        ) : undefined}
        <TextInput
          mode="outlined"
          inputMode="numeric"
          submitBehavior="blurAndSubmit"
          returnKeyType="done"
          style={{ width: spacing[24], textAlign: 'center' }}
          value={minutes}
          readOnly={readonly}
          onChangeText={updateMinutes}
          onBlur={resetValues}
          right={<TextInput.Affix text="m" />}
        />
        <Text
          style={{
            alignSelf: 'center',
            ...font['text-xl'],
            fontWeight: 'bold',
            color: colors.onSecondaryContainer,
          }}
        >
          :
        </Text>
        <TextInput
          mode="outlined"
          inputMode="numeric"
          submitBehavior="blurAndSubmit"
          returnKeyType="done"
          style={{ width: spacing[24], textAlign: 'center' }}
          value={seconds}
          readOnly={readonly}
          onChangeText={updateSeconds}
          onBlur={resetValues}
          right={<TextInput.Affix text="s" />}
        />
      </View>
    </>
  );
}
