import RecordedExerciseNotesEditor from '@/components/presentation/workout/recorded-exercise-notes-editor';
import { spacing, useAppTheme } from '@/hooks/useAppTheme';
import { useAppSelectorWithArg } from '@/store';
import { selectExerciseNotes, setExerciseNotes } from '@/store/stored-sessions';
import { useTranslate } from '@tolgee/react';
import { useState } from 'react';
import { Card, Icon, Text } from 'react-native-paper';
import { useDispatch } from 'react-redux';

interface ExerciseNotesFieldProps {
  exerciseName: string;
  isReadonly: boolean;
}

/**
 * Notes which are attached to the exercise itself rather than a single
 * session, so the same text shows up every workout containing the exercise.
 */
export default function ExerciseNotesField(props: ExerciseNotesFieldProps) {
  const { exerciseName, isReadonly } = props;
  const dispatch = useDispatch();
  const { t } = useTranslate();
  const { colors } = useAppTheme();
  const notes = useAppSelectorWithArg(selectExerciseNotes, exerciseName);
  const [editorOpen, setEditorOpen] = useState(false);

  if (isReadonly) {
    return undefined;
  }

  return (
    <>
      <Card
        mode="contained"
        style={{ marginTop: spacing[4] }}
        onPress={() => setEditorOpen(true)}
        testID="exercise-notes-field"
      >
        <Card.Content
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing[2],
          }}
        >
          <Icon source={'notes'} size={20} color={colors.onSurfaceVariant} />
          <Text
            testID="exercise-notes-field-text"
            style={{ flex: 1, ...(notes ? {} : { color: colors.outline }) }}
          >
            {notes ?? t('exercise.notes.add.label')}
          </Text>
        </Card.Content>
      </Card>
      <RecordedExerciseNotesEditor
        exerciseName={exerciseName}
        titleKeyName="exercise.notes_for.title"
        open={editorOpen}
        notes={notes}
        onUpdateNotes={(newNotes) =>
          dispatch(setExerciseNotes({ exerciseName, notes: newNotes }))
        }
        onDismiss={() => setEditorOpen(false)}
      />
    </>
  );
}
