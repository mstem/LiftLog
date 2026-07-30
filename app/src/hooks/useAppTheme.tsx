import { useAppSelector } from '@/store';
import {
  Material3Scheme,
  Material3Theme,
  useMaterial3Theme,
} from '@pchmn/expo-material3-theme';
import React, { createContext, ReactNode, useContext, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from 'react-native-paper';
import {
  DarkTheme,
  ThemeProvider as NavigationThemeProvider,
  DefaultTheme,
} from 'expo-router';
import { MsIconSrc } from '@/components/presentation/foundation/ms-icon-source';
import {
  argbFromHex,
  Blend,
  Hct,
  hexFromArgb,
} from '@material/material-color-utilities';

export const rounding = {
  roundedRectangleRadius: 14,
  roundedRectangleFocusRingRadius: 19,
  segmentedBetweenRadius: 2,
};

// Hevy-inspired scheme: flat white cards on a cool off-white background,
// saturated blue accents, near-black text. Used when no custom seed is set.
const hevyTheme: Material3Theme = {
  light: {
    primary: '#2f80ed',
    onPrimary: '#ffffff',
    primaryContainer: '#e0edfd',
    onPrimaryContainer: '#14539f',
    secondary: '#526070',
    onSecondary: '#ffffff',
    secondaryContainer: '#e8f1fd',
    onSecondaryContainer: '#1c5cb0',
    tertiary: '#2e9e63',
    onTertiary: '#ffffff',
    tertiaryContainer: '#d9f4e4',
    onTertiaryContainer: '#0e6a3c',
    error: '#e5484d',
    onError: '#ffffff',
    errorContainer: '#fdebec',
    onErrorContainer: '#8c1d22',
    background: '#f4f5f7',
    onBackground: '#101828',
    surface: '#ffffff',
    onSurface: '#101828',
    surfaceVariant: '#eef1f4',
    onSurfaceVariant: '#667085',
    outline: '#98a2b3',
    outlineVariant: '#e4e7ec',
    inverseSurface: '#1d2939',
    inverseOnSurface: '#f2f4f7',
    inversePrimary: '#8ab9f5',
    shadow: '#000000',
    scrim: '#000000',
    surfaceDisabled: 'rgba(16, 24, 40, 0.12)',
    onSurfaceDisabled: 'rgba(16, 24, 40, 0.38)',
    backdrop: 'rgba(16, 24, 40, 0.4)',
    surfaceContainerLowest: '#ffffff',
    surfaceContainerLow: '#ffffff',
    surfaceContainer: '#ffffff',
    surfaceContainerHigh: '#f2f4f7',
    surfaceContainerHighest: '#e9edf1',
    surfaceBright: '#ffffff',
    surfaceDim: '#e9edf1',
    surfaceTint: '#2f80ed',
    elevation: {
      level0: 'transparent',
      level1: '#ffffff',
      level2: '#fbfcfd',
      level3: '#f6f8fa',
      level4: '#f2f4f7',
      level5: '#eef1f4',
    },
  },
  dark: {
    primary: '#4c96f0',
    onPrimary: '#ffffff',
    primaryContainer: '#1b4a85',
    onPrimaryContainer: '#d4e5fc',
    secondary: '#9aa6b4',
    onSecondary: '#1a2027',
    secondaryContainer: '#243b58',
    onSecondaryContainer: '#cfe2fa',
    tertiary: '#4fd68a',
    onTertiary: '#04361c',
    tertiaryContainer: '#14532d',
    onTertiaryContainer: '#c9f3da',
    error: '#f2555a',
    onError: '#ffffff',
    errorContainer: '#5c1a1e',
    onErrorContainer: '#fdd8d9',
    background: '#101213',
    onBackground: '#f0f2f4',
    surface: '#101213',
    onSurface: '#f0f2f4',
    surfaceVariant: '#23272b',
    onSurfaceVariant: '#9aa4ae',
    outline: '#5c6670',
    outlineVariant: '#2c3238',
    inverseSurface: '#f0f2f4',
    inverseOnSurface: '#1a1d1f',
    inversePrimary: '#2f80ed',
    shadow: '#000000',
    scrim: '#000000',
    surfaceDisabled: 'rgba(240, 242, 244, 0.12)',
    onSurfaceDisabled: 'rgba(240, 242, 244, 0.38)',
    backdrop: 'rgba(0, 0, 0, 0.5)',
    surfaceContainerLowest: '#0b0d0e',
    surfaceContainerLow: '#17191b',
    surfaceContainer: '#1b1e20',
    surfaceContainerHigh: '#22262a',
    surfaceContainerHighest: '#2a2f34',
    surfaceBright: '#33383d',
    surfaceDim: '#101213',
    surfaceTint: '#4c96f0',
    elevation: {
      level0: 'transparent',
      level1: '#17191b',
      level2: '#1b1e20',
      level3: '#22262a',
      level4: '#262b2f',
      level5: '#2a2f34',
    },
  },
};

export const spacing = {
  pageHorizontalMargin: 16, // spacing[4]
  0: 0,
  0.5: 2,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  11: 44,
  12: 48,
  14: 56,
  15: 60,
  16: 64,
  20: 80,
  24: 96,
  28: 112,
  32: 128,
  36: 144,
  40: 160,
  44: 176,
  48: 192,
  52: 208,
  56: 224,
  60: 240,
  64: 256,
} as const;

export const font = {
  'text-2xs': {
    fontSize: 10,
    lineHeight: 14,
  },
  'text-xs': {
    fontSize: 12,
    lineHeight: 16,
  },
  'text-sm': {
    fontSize: 14,
    lineHeight: 20,
  },
  'text-base': {
    fontSize: 16,
    lineHeight: 24,
  },
  'text-lg': {
    fontSize: 18,
    lineHeight: 28,
  },
  'text-xl': {
    fontSize: 20,
    lineHeight: 28,
  },
  'text-2xl': {
    fontSize: 24,
    lineHeight: 32,
  },
  'text-3xl': {
    fontSize: 30,
    lineHeight: 40,
  },
  'text-4xl': {
    fontSize: 40,
    lineHeight: 50,
  },
} as const;

export type FontChoice = keyof typeof font;

type ColorPair<T extends string> = { [k in T | `on${Capitalize<T>}`]: string };

export type AppThemeColors = Material3Scheme & {
  orange: string;
  onOrange: string;
  red: string;
  onRed: string;
  green: string;
  onGreen: string;
  blue: string;
  onBlue: string;
  yellow: string;
  onYellow: string;
  purple: string;
  onPurple: string;
  pink: string;
  onPink: string;
  teal: string;
  onTeal: string;
  cyan: string;
  onCyan: string;
  brown: string;
  onBrown: string;
  indigo: string;
  onIndigo: string;
  lime: string;
  onLime: string;
  amber: string;
  onAmber: string;
};

export type ColorChoice = keyof {
  [K in keyof AppThemeColors as AppThemeColors[K] extends string
    ? K
    : never]: AppThemeColors[K];
};

export interface AppTheme {
  colors: AppThemeColors;
  colorScheme: 'light' | 'dark';
}

const AppThemeContext = createContext<AppTheme | undefined>(undefined);

export const useAppTheme = (): AppTheme => {
  const context = useContext(AppThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within a AppThemeProvider');
  }
  return context;
};

interface AppThemeProviderProps {
  children: ReactNode;
}

export const AppThemeProvider: React.FC<AppThemeProviderProps> = ({
  children,
}) => {
  const colorSchemeSeed = useAppSelector(
    (state) => state.settings.colorSchemeSeed,
  );
  const trueBlack = useAppSelector(
    (state) => state.settings.trueBlackDarkTheme,
  );

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  // If the device is not compatible, it will return a theme based on the fallback source color (optional, default to #6750A4)
  const { theme, updateTheme, resetTheme } = useMaterial3Theme({
    fallbackSourceColor: '0x005500',
    sourceColor: colorSchemeSeed === 'default' ? undefined! : colorSchemeSeed,
  });
  const isHevyDefault = colorSchemeSeed === 'default';
  let newTheme = isHevyDefault ? hevyTheme : theme;
  if (trueBlack) {
    newTheme = {
      ...newTheme,
      dark: { ...newTheme.dark, background: '#000000', surface: '#000000' },
    };
  }
  useEffect(() => {
    if (colorSchemeSeed === 'default') {
      resetTheme();
    } else {
      updateTheme(colorSchemeSeed);
    }
    // eslint-disable-next-line react-compiler/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorSchemeSeed]);
  const schemedTheme = colorScheme === 'dark' ? newTheme.dark : newTheme.light;

  const paperTheme = isDark
    ? { ...MD3DarkTheme, colors: newTheme.dark }
    : { ...MD3LightTheme, colors: newTheme.light };
  const appTheme = {
    colors: {
      ...schemedTheme,
      ...colorPair('orange', 'ffffa500', schemedTheme.primary, isDark),
      ...colorPair('red', 'ffff0000', schemedTheme.primary, isDark),
      ...colorPair('yellow', 'ffffff00', schemedTheme.primary, isDark),
      ...colorPair('blue', 'ff0000aa', schemedTheme.primary, isDark),
      ...colorPair('green', 'ff00aa00', schemedTheme.primary, isDark),
      ...colorPair('purple', 'ff800080', schemedTheme.primary, isDark),
      ...colorPair('pink', 'ffff69b4', schemedTheme.primary, isDark),
      ...colorPair('teal', 'ff008080', schemedTheme.primary, isDark),
      ...colorPair('cyan', 'ff00ffff', schemedTheme.primary, isDark),
      ...colorPair('brown', 'ff8b4513', schemedTheme.primary, isDark),
      ...colorPair('indigo', 'ff4b0082', schemedTheme.primary, isDark),
      ...colorPair('lime', 'ffcddc39', schemedTheme.primary, isDark),
      ...colorPair('amber', 'ffffc107', schemedTheme.primary, isDark),
      ...(isHevyDefault
        ? {
            blue: schemedTheme.primary,
            onBlue: '#ffffff',
            green: isDark ? '#3ecf7e' : '#3dbd77',
            onGreen: '#ffffff',
          }
        : {}),
    } satisfies AppThemeColors,
    colorScheme: colorScheme === 'unspecified' ? 'light' : colorScheme,
  };

  const baseNavigationThem = isDark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseNavigationThem,
    colors: {
      background: paperTheme.colors.background,
      border: paperTheme.colors.outline,
      card: paperTheme.colors.surfaceContainer,
      notification: paperTheme.colors.surface,
      primary: paperTheme.colors.primary,
      text: paperTheme.colors.onSurface,
    },
  };

  return (
    <AppThemeContext.Provider value={appTheme}>
      <PaperProvider
        theme={paperTheme}
        settings={{
          icon: (props) => (
            <MsIconSrc
              {...props}
              color={props.color ?? appTheme.colors.onSurface}
            />
          ),
        }}
      >
        <NavigationThemeProvider value={navigationTheme}>
          {children}
        </NavigationThemeProvider>
      </PaperProvider>
    </AppThemeContext.Provider>
  );
};

function colorPair<T extends string>(
  name: T,
  hex: string,
  primary: string,
  isDark: boolean,
): ColorPair<T> {
  // Step 1: Harmonize the input with the seed
  const harmonized = Blend.harmonize(argbFromHex(hex), argbFromHex(primary));
  const baseHct = Hct.fromInt(harmonized);

  // Step 2: Adjust tone based on theme context
  baseHct.tone = isDark ? 80 : 40; // Material-like defaults

  // Step 3: Derive on-color from tone inversion
  const onTone = baseHct.tone > 60 ? 10 : 100;
  const onColor = Hct.from(baseHct.hue, baseHct.chroma, onTone);

  // Step 4: Material-style return shape
  const onName = `on${name.charAt(0).toUpperCase()}${name.slice(1)}` as const;

  return {
    [name]: hexFromArgb(baseHct.toInt()),
    [onName]: hexFromArgb(onColor.toInt()),
  } as ColorPair<T>;
}
