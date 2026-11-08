import FullScreenDialog from '@/components/presentation/foundation/full-screen-dialog';
import { spacing } from '@/hooks/useAppTheme';
import {
  loggedExerciseNames,
  searchSwapOptions,
} from '@/components/presentation/workout/swap-search';
import { relatedExercises } from '@/models/related-exercises';
import { useAppSelector } from '@/store';
import { selectExercises, selectSessions } from '@/store/stored-sessions';
import { useTranslate } from '@tolgee/react';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { List, TextInput } from 'react-native-paper';

const shown = 15;
// The library has 21 bench presses, so a search can match more lifts than
// fit on a screen. Typed searches list this many; the dialog scrolls.
const searchShown = 60;

/**
 * Picks a lift to swap in: the closest library matches for the planned lift,
 * or any exercise by name once something is typed.
 */
export function SwapExerciseDialog(props: {
  exerciseName: string | undefined;
  onSwap: (name: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslate();
  const exercises = useAppSelector(selectExercises);
  const [search, setSearch] = useState('');
  const sessions = useAppSelector(selectSessions);
  const library = useMemo(() => Object.values(exercises), [exercises]);
  const logged = useMemo(() => loggedExerciseNames(sessions), [sessions]);

  const options = useMemo(() => {
    if (!props.exerciseName) {
      return [];
    }
    if (!search.trim()) {
      return relatedExercises({
        name: props.exerciseName,
        library,
        limit: shown,
      });
    }
    return searchSwapOptions({
      search,
      library,
      logged,
      exclude: props.exerciseName,
      limit: searchShown,
    });
  }, [props.exerciseName, search, library, logged]);

  const close = () => {
    setSearch('');
    props.onClose();
  };

  return (
    <FullScreenDialog
      open={!!props.exerciseName}
      title={t('workout.swap_exercise.title', {
        name: props.exerciseName ?? '',
      })}
      onClose={close}
      avoidKeyboard
    >
      <View style={{ gap: spacing[2] }}>
        <TextInput
          mode="outlined"
          label={t('workout.swap_exercise.search.label')}
          value={search}
          onChangeText={setSearch}
        />
        {options.map((x) => (
          <List.Item
            key={x.name}
            title={x.name}
            description={x.equipment ?? undefined}
            onPress={() => {
              props.onSwap(x.name);
              close();
            }}
          />
        ))}
      </View>
    </FullScreenDialog>
  );
}
