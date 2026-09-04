import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme/useTheme';

export type SurfaceProps = ViewProps & {
  elevated?: boolean;
};

export function Surface({ elevated = false, style, ...rest }: SurfaceProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: elevated ? theme.colors.surfaceElevated : theme.colors.surface,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.lg,
        },
        theme.shadow,
        style,
      ]}
      {...rest}
    />
  );
}
