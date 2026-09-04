import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';
import ToastMessage, {
  type ToastConfig,
  type ToastConfigParams,
  type ToastShowParams,
} from 'react-native-toast-message';

import { Surface } from './Surface';
import { Text } from './Text';
import { useTheme } from '@/theme/useTheme';
import type { ColorToken } from '@/theme/tokens';

export type ToastType = 'success' | 'error' | 'info';

export type ShowToastOptions = {
  type?: ToastType;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
};

const ACCENT: Record<ToastType, ColorToken> = {
  success: 'positive',
  error: 'negative',
  info: 'primary',
};

type ToastPayload = Pick<ShowToastOptions, 'action'>;

function TallyToast({
  type,
  text1,
  text2,
  props,
}: ToastConfigParams<ToastPayload> & { type: ToastType }) {
  const theme = useTheme();
  const action = props?.action;

  return (
    <Surface
      elevated
      style={{
        marginHorizontal: theme.screenPadding,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        borderLeftWidth: 4,
        borderLeftColor: theme.colors[ACCENT[type]],
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="headline">{text1}</Text>
        {text2 ? (
          <Text variant="footnote" color="textSecondary">
            {text2}
          </Text>
        ) : null}
      </View>
      {action ? (
        <Pressable accessibilityRole="button" onPress={action.onPress} hitSlop={8}>
          <Text variant="headline" color="primary">
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </Surface>
  );
}

export const toastConfig: ToastConfig = {
  success: (props) => <TallyToast {...props} type="success" />,
  error: (props) => <TallyToast {...props} type="error" />,
  info: (props) => <TallyToast {...props} type="info" />,
};

export function showToast({ type = 'info', title, message, action }: ShowToastOptions) {
  Haptics.notificationAsync(
    type === 'error'
      ? Haptics.NotificationFeedbackType.Error
      : type === 'success'
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
  );

  const params: ToastShowParams = {
    type,
    text1: title,
    text2: message,
    props: { action } satisfies ToastPayload,
  };
  ToastMessage.show(params);
}

export { ToastMessage };
