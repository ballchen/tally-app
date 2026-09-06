import type { GroupListItem } from '@tally/shared/queries/groups';
import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { GroupCard } from './GroupCard';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/useTheme';
import type { ColorToken } from '@/theme/tokens';

export type SwipeAction = {
  key: string;
  label: string;
  color: ColorToken;
  /** Swipe actions are one tap away from an irreversible-looking change, so each confirms. */
  confirm: { message: string; confirmLabel: string; cancelLabel: string };
  onPress: () => void;
};

export type GroupRowProps = {
  group: GroupListItem;
  balance: number | undefined;
  actions: SwipeAction[];
  onPress: () => void;
};

const ACTION_WIDTH = 96;

export function GroupRow({ group, balance, actions, onPress }: GroupRowProps) {
  const theme = useTheme();
  const swipeable = useRef<Swipeable>(null);

  const confirm = (action: SwipeAction) => {
    swipeable.current?.close();
    Alert.alert(group.name, action.confirm.message, [
      { text: action.confirm.cancelLabel, style: 'cancel' },
      { text: action.confirm.confirmLabel, onPress: action.onPress },
    ]);
  };

  const renderActions = () => (
    <View style={{ flexDirection: 'row' }}>
      {actions.map((action) => (
        <Pressable
          key={action.key}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          testID={`swipe-${action.key}-${group.id}`}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            confirm(action);
          }}
          style={{
            width: ACTION_WIDTH,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.colors[action.color],
            borderRadius: theme.radius.lg,
            marginLeft: theme.spacing.sm,
          }}
        >
          <Text variant="subhead" color="onPrimary" style={{ textAlign: 'center' }}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  if (actions.length === 0) {
    return <GroupCard group={group} balance={balance} onPress={onPress} />;
  }

  return (
    <Swipeable
      ref={swipeable}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={renderActions}
    >
      <GroupCard
        group={group}
        balance={balance}
        onPress={onPress}
        swipeActions={actions.map((action) => ({
          name: action.label,
          run: () => confirm(action),
        }))}
      />
    </Swipeable>
  );
}
