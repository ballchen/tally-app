import { Pressable } from 'react-native';

import { Text } from './Text';
import { useTheme } from '@/theme/useTheme';

export type HeaderButtonProps = {
  title: string;
  onPress: () => void;
  testID?: string;
  disabled?: boolean;
  destructive?: boolean;
};

export function HeaderButton({
  title,
  onPress,
  testID,
  disabled = false,
  destructive = false,
}: HeaderButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      hitSlop={12}
      style={{ opacity: disabled ? 0.4 : 1, paddingHorizontal: theme.spacing.xs }}
    >
      <Text variant="body" color={destructive ? 'negative' : 'primary'}>
        {title}
      </Text>
    </Pressable>
  );
}
