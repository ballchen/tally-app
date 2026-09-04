import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme/useTheme';
import type { ColorToken, TypographyToken } from '@/theme/tokens';

export type TextProps = RNTextProps & {
  variant?: TypographyToken;
  color?: ColorToken;
};

export function Text({ variant = 'body', color = 'text', style, ...rest }: TextProps) {
  const theme = useTheme();
  const token = theme.typography[variant] as TextStyle;

  return (
    <RNText
      maxFontSizeMultiplier={theme.maxFontSizeMultiplier}
      style={[token, { color: theme.colors[color] }, style]}
      {...rest}
    />
  );
}
