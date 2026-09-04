import { View } from 'react-native';

import { HeaderButton } from './HeaderButton';
import { Text } from './Text';
import { useTheme } from '@/theme/useTheme';

export type SheetHeaderProps = {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children?: React.ReactNode;
};

/**
 * Form sheets draw their own header: a native one floats over the content, and
 * react-native-screens expects the sheet to hold exactly a header and a scroll view.
 */
export function SheetHeader({ title, closeLabel, onClose, children }: SheetHeaderProps) {
  const theme = useTheme();

  return (
    <View
      // A collapsed view is flattened away and the sheet loses track of its header.
      collapsable={false}
      style={{
        paddingHorizontal: theme.screenPadding,
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.md,
        gap: theme.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        backgroundColor: theme.colors.background,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          <HeaderButton testID="sheet-close" title={closeLabel} onPress={onClose} />
        </View>
        <Text variant="headline">{title}</Text>
        <View style={{ flex: 1 }} />
      </View>
      {children}
    </View>
  );
}
