import Button from '@/components/presentation/foundation/gesture-wrappers/button';
import { T } from '@tolgee/react';
import { TranslationKey } from '@tolgee/web';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { Portal, Dialog, TextInput } from 'react-native-paper';

export default function RecordedExerciseNotesEditor(props: {
  exerciseName: string;
  open: boolean;
  notes: string | undefined;
  titleKeyName?: TranslationKey;
  onUpdateNotes: (n: string) => void;
  onDismiss: () => void;
}) {
  const { open, notes, onUpdateNotes, onDismiss, exerciseName } = props;
  const titleKeyName = props.titleKeyName ?? 'workout.notes_for.title';
  const [editorNotes, setEditorNotes] = useState(notes ?? '');

  useEffect(() => {
    setEditorNotes(notes || '');
  }, [notes]);
  return (
    open && (
      <Portal>
        <KeyboardAvoidingView
          behavior={'height'}
          style={{
            flex: 1,
            pointerEvents: open ? 'box-none' : 'none',
          }}
        >
          <Dialog visible={open} onDismiss={onDismiss}>
            <Dialog.Title>
              <T keyName={titleKeyName} params={{ name: exerciseName }} />
            </Dialog.Title>
            <Dialog.Content>
              <TextInput
                defaultValue={editorNotes}
                multiline
                mode="outlined"
                numberOfLines={6}
                onChangeText={setEditorNotes}
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button
                testID="cancel-notes"
                onPress={() => {
                  onDismiss();
                  setEditorNotes(notes || '');
                }}
              >
                <T keyName="generic.cancel.button" />
              </Button>
              <Button
                testID="save-notes"
                onPress={() => {
                  onUpdateNotes(editorNotes);
                  onDismiss();
                }}
              >
                <T keyName="generic.save.button" />
              </Button>
            </Dialog.Actions>
          </Dialog>
        </KeyboardAvoidingView>
      </Portal>
    )
  );
}
