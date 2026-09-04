import { ScrollView, type StyleProp, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/useTheme';

export type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  center?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({ children, scroll = true, center = false, contentStyle }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const root: ViewStyle = { flex: 1, backgroundColor: theme.colors.background };
  const horizontal: ViewStyle = {
    paddingHorizontal: theme.screenPadding,
    gap: theme.spacing.lg,
  };

  if (!scroll) {
    return (
      <View
        style={[
          root,
          horizontal,
          { paddingTop: insets.top + theme.spacing.lg, paddingBottom: insets.bottom + theme.spacing.xl },
          center && { justifyContent: 'center' },
          contentStyle,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      style={root}
      keyboardShouldPersistTaps="handled"
      // Lets iOS inset for the navigation bar and safe area; a KeyboardAvoidingView
      // would collapse to zero height inside a form sheet.
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={[
        horizontal,
        { paddingTop: theme.spacing.lg, paddingBottom: insets.bottom + theme.spacing.xl },
        center && { flexGrow: 1, justifyContent: 'center' },
        contentStyle,
      ]}
    >
      {children}
    </ScrollView>
  );
}
