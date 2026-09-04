import { useCreateGroup } from '@tally/shared/queries/groups';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { CurrencyField } from '@/components/ui/CurrencyField';
import { Input } from '@/components/ui/Input';
import { SheetHeader } from '@/components/ui/SheetHeader';
import { errorMessage } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { useTheme } from '@/theme/useTheme';

export default function NewGroupScreen() {
  const theme = useTheme();
  const router = useRouter();
  const t = useT('CreateGroup');
  const tEdit = useT('EditGroup');
  const createGroup = useCreateGroup();

  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('TWD');

  const submit = async () => {
    try {
      await createGroup.mutateAsync({ name: name.trim(), baseCurrency: currency });
      router.back();
    } catch (error) {
      // A toast renders behind the form sheet; a native alert is drawn above it.
      Alert.alert(tEdit('error.update'), errorMessage(error));
    }
  };

  return (
    <>
      <SheetHeader
        title={t('newGroup')}
        closeLabel={tEdit('cancel')}
        onClose={() => router.back()}
      />
      <Screen>
        <View style={{ gap: theme.spacing.lg }}>
          <Input
            testID="group-name"
            label={t('groupName')}
            placeholder={t('groupNamePlaceholder')}
            value={name}
            onChangeText={setName}
            returnKeyType="done"
          />
          <CurrencyField
            testID="group-currency"
            label={t('baseCurrency')}
            value={currency}
            onChange={setCurrency}
          />
        </View>
        <Button
          testID="create-group-submit"
          size="lg"
          title={t('create')}
          disabled={name.trim().length === 0}
          loading={createGroup.isPending}
          onPress={submit}
        />
      </Screen>
    </>
  );
}
