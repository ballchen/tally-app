import { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { showToast } from '@/components/ui/Toast';
import { useTheme } from '@/theme/useTheme';

export default function ComponentGallery() {
  const theme = useTheme();
  const [value, setValue] = useState('');

  return (
    <Screen>
      <Text variant="largeTitle">Components</Text>
      <Text variant="footnote" color="textSecondary">
        Scheme: {theme.scheme}
      </Text>

      <Surface style={{ gap: theme.spacing.md }}>
        <Text variant="title2">Button</Text>
        <Button title="Primary" />
        <Button title="Secondary" variant="secondary" />
        <Button title="Ghost" variant="ghost" />
        <Button title="Destructive" variant="destructive" />
        <Button title="Large" size="lg" />
        <Button title="Loading" loading />
      </Surface>

      <Surface style={{ gap: theme.spacing.md }}>
        <Text variant="title2">Input</Text>
        <Input label="Email" value={value} onChangeText={setValue} placeholder="you@example.com" />
        <Input label="With error" value="" error="Something is wrong" />
      </Surface>

      <Surface style={{ gap: theme.spacing.md }}>
        <Text variant="title2">Avatar</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Avatar name="Ball" size={20} />
          <Avatar name="Ball" size={28} />
          <Avatar name="Ball" size={40} />
          <Avatar name="Ball" size={64} />
        </View>
      </Surface>

      <Surface style={{ gap: theme.spacing.md }}>
        <Text variant="title2">Skeleton</Text>
        <Skeleton height={24} />
        <Skeleton width="60%" />
      </Surface>

      <Surface style={{ gap: theme.spacing.md }}>
        <Text variant="title2">Typography</Text>
        <Text variant="title1">Title 1</Text>
        <Text variant="headline">Headline</Text>
        <Text variant="body">Body</Text>
        <Text variant="amountL">1,234.50</Text>
      </Surface>

      <Surface style={{ gap: theme.spacing.md }}>
        <Text variant="title2">Toast</Text>
        <Button
          title="Show success"
          onPress={() =>
            showToast({
              type: 'success',
              title: 'Payment recorded',
              message: 'Ball paid Amy NT$300',
              action: { label: 'Undo', onPress: () => {} },
            })
          }
        />
        <Button
          title="Show error"
          variant="destructive"
          onPress={() => showToast({ type: 'error', title: 'Something went wrong' })}
        />
      </Surface>
    </Screen>
  );
}
