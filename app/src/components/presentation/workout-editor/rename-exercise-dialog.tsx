import Button from '@/components/presentation/foundation/gesture-wrappers/button';
import { useTranslate } from '@tolgee/react';
import { useEffect, useState } from 'react';
import { Dialog, Portal, Text, TextInput } from 'react-native-paper';

/** Asks for a lift's new name; the caller renames it everywhere. */
export default function RenameExerciseDialog(props: {
  visible: boolean;
  name: string;
  onDismiss: () => void;
  onRename: (name: string) => void;
}) {
  const { t } = useTranslate();
  const [name, setName] = useState(props.name);
  useEffect(() => {
    if (props.visible) {
      setName(props.name);
    }
  }, [props.visible, props.name]);
  const trimmed = name.trim();
  const canSave = !!trimmed && trimmed !== props.name;

  return (
    <Portal>
      <Dialog visible={props.visible} onDismiss={props.onDismiss}>
        <Dialog.Title>{t('exercise.rename.title')}</Dialog.Title>
        <Dialog.Content>
          <TextInput
            testID="rename-exercise-input"
            label={t('exercise.name.label')}
            value={name}
            onChangeText={setName}
            autoFocus
            selectTextOnFocus
          />
          <Text variant="bodySmall" style={{ marginTop: 8 }}>
            {t('exercise.rename.body')}
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={props.onDismiss}>
            {t('generic.cancel.button')}
          </Button>
          <Button
            testID="rename-exercise-save"
            disabled={!canSave}
            onPress={() => props.onRename(trimmed)}
          >
            {t('generic.save.button')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
