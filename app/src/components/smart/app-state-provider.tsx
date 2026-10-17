import { Loader } from '@/components/presentation/foundation/loader';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useAppSelector } from '@/store';
import { ReactNode, useRef } from 'react';
import { Animated } from 'react-native';

export function AppStateProvider({ children }: { children: ReactNode }) {
  const waitingOn = useAppSelector(
    (s) =>
      getLoadMessage(s.app, 'app settings') ||
      getLoadMessage(s.currentSession, 'current session') ||
      getLoadMessage(s.program, 'program') ||
      getLoadMessage(s.settings, 'settings') ||
      getLoadMessage(s.storedSessions, 'stored sessions') ||
      getLoadMessage(s.aiPlanner, 'ai planner') ||
      getLoadMessage(s.injury, 'injury'),
  );
  const { colors } = useAppTheme();
  const isWaiting = !!waitingOn;
  const anim = useRef(new Animated.Value(1)).current;

  if (isWaiting) {
    return (
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: colors.surface,
          alignItems: 'center',
          opacity: anim,
        }}
      >
        <Loader loadingText={waitingOn ?? ''} />
      </Animated.View>
    );
  }

  return children;
}

function getLoadMessage(state: { isHydrated: boolean }, type: string) {
  if (state.isHydrated) return undefined;
  return 'Loading ' + type;
}
