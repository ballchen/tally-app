import { useColorScheme } from 'react-native';

import {
  blurIntensity,
  maxFontSizeMultiplier,
  palette,
  radius,
  screenPadding,
  shadow,
  spacing,
  typography,
  type ColorScheme,
} from './tokens';

export type Theme = {
  scheme: ColorScheme;
  colors: (typeof palette)[ColorScheme];
  spacing: typeof spacing;
  radius: typeof radius;
  screenPadding: typeof screenPadding;
  typography: typeof typography;
  shadow: (typeof shadow)[ColorScheme];
  maxFontSizeMultiplier: number;
  blurIntensity: number;
};

export function useTheme(): Theme {
  const scheme: ColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  return {
    scheme,
    colors: palette[scheme],
    spacing,
    radius,
    screenPadding,
    typography,
    shadow: shadow[scheme],
    maxFontSizeMultiplier,
    blurIntensity,
  };
}
