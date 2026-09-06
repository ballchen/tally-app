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
      // would collapse to zero height inside a form sheet. A centred screen has to
      // opt out and pad itself instead: `flexGrow` sizes the content to the scroll
      // view's *frame*, so an automatic inset on top of that leaves a form that
      // fits on screen scrollable by the height of the safe area.
      contentInsetAdjustmentBehavior={center ? 'never' : 'automatic'}
      automaticallyAdjustKeyboardInsets
      // The keyboard's inset is then the only thing that can make these screens
      // scroll; without this a form that fits still rubber-bands under a drag.
      bounces={false}
      alwaysBounceVertical={false}
      contentContainerStyle={[
        horizontal,
        {
          flexGrow: 1,
          paddingTop: (center ? insets.top : 0) + theme.spacing.lg,
          paddingBottom: insets.bottom + theme.spacing.xl,
        },
        center && { justifyContent: 'center' },
        contentStyle,
      ]}
    >
      {children}
    </ScrollView>
  );
}
