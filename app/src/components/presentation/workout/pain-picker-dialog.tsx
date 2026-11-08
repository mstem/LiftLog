import { spacing } from '@/hooks/useAppTheme';
import { useTranslate } from '@tolgee/react';
import { View } from 'react-native';
import { Chip, Dialog, Portal } from 'react-native-paper';
import Button from '@/components/presentation/foundation/gesture-wrappers/button';

const painScores = Array.from({ length: 11 }, (_, i) => i);

/**
 * Asks for a 0 to 10 pain score after a set. It needs a choice: no backdrop or
 * back-button dismiss, and Skip records nothing.
 */
export default function PainPickerDialog(props: {
  visible: boolean;
  onPick: (pain: number) => void;
  onSkip: () => void;
}) {
  const { t } = useTranslate();
  return (
    <Portal>
      <Dialog
        visible={props.visible}
        dismissable={false}
        dismissableBackButton={false}
      >
        <Dialog.Title>{t('injury.pain.question')}</Dialog.Title>
        <Dialog.Content>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: spacing[2],
            }}
          >
            {painScores.map((pain) => (
              <Chip
                key={pain}
                testID={`pain-${pain}`}
                onPress={() => props.onPick(pain)}
              >
                {pain}
              </Chip>
            ))}
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          <Button testID="pain-skip" onPress={props.onSkip}>
            {t('injury.pain.skip')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
