import type { GroupMember } from '@tally/shared/members';
import { useGroupDetails } from '@tally/shared/queries/group-details';
import {
  useArchiveGroup,
  useDeleteGroup,
  useHideGroup,
  useLeaveGroup,
  useRemoveMember,
  useUpdateGroup,
  useUploadGroupCoverBinary,
} from '@tally/shared/queries/groups';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Share, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { CurrencyField } from '@/components/ui/CurrencyField';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { SheetHeader } from '@/components/ui/SheetHeader';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { errorMessage, isUnsettledBalanceError } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { sortMembers } from '@/lib/members';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/theme/useTheme';

const COVER_WIDTH = 1600;
const COVER_QUALITY = 0.8;
const INVITE_BASE_URL = 'https://tally.app/join';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="footnote" color="textSecondary">
        {title.toUpperCase()}
      </Text>
      <Surface style={{ gap: theme.spacing.md }}>{children}</Surface>
    </View>
  );
}

export default function GroupSettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const t = useT('EditGroup');
  const tGroupDetails = useT('GroupDetails');
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((s) => s.session?.user.id);

  const details = useGroupDetails(id);
  const updateGroup = useUpdateGroup();
  const uploadCover = useUploadGroupCoverBinary();
  const archiveGroup = useArchiveGroup();
  const hideGroup = useHideGroup();
  const deleteGroup = useDeleteGroup();
  const leaveGroup = useLeaveGroup();
  const removeMember = useRemoveMember();

  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [currencyDraft, setCurrencyDraft] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [status, setStatus] = useState<{ tone: 'positive' | 'negative'; text: string } | null>(null);

  const group = details.data?.group;
  const members = sortMembers(details.data?.members ?? []);
  const isOwner = Boolean(group && userId && group.created_by === userId);
  const currencyLocked = (details.data?.expenses.length ?? 0) > 0;
  const isHidden = Boolean(members.find((m) => m.user_id === userId)?.hidden_at);
  const isArchived = Boolean(group?.archived_at);

  const name = nameDraft ?? group?.name ?? '';
  const currency = currencyDraft ?? group?.base_currency ?? 'TWD';
  const dirty = name !== group?.name || currency !== group?.base_currency;

  // A toast renders behind the form sheet, so feedback goes into the sheet itself.
  const report = async (run: () => Promise<unknown>, successKey: string, errorKey: string) => {
    try {
      await run();
      setStatus({ tone: 'positive', text: t(`success.${successKey}`) });
      return true;
    } catch (error) {
      const detail = isUnsettledBalanceError(error) ? t('settleFirst') : errorMessage(error);
      setStatus({ tone: 'negative', text: detail ?? t(`error.${errorKey}`) });
      return false;
    }
  };

  const pickCover = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
    });
    if (picked.canceled) return;

    await report(async () => {
      const resized = await ImageManipulator.manipulateAsync(
        picked.assets[0].uri,
        [{ resize: { width: COVER_WIDTH } }],
        { compress: COVER_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
      );
      const body = await fetch(resized.uri).then((response) => response.arrayBuffer());
      const url = await uploadCover.mutateAsync({
        groupId: id,
        body,
        extension: 'jpg',
        contentType: 'image/jpeg',
      });
      await updateGroup.mutateAsync({ groupId: id, coverImageUrl: url });
    }, 'coverUpdated', 'uploadCover');
  };

  const removeCover = () =>
    report(
      () => updateGroup.mutateAsync({ groupId: id, coverImageUrl: null }),
      'coverRemoved',
      'removeCover',
    );

  const saveDetails = () =>
    report(
      () => updateGroup.mutateAsync({ groupId: id, name: name.trim(), baseCurrency: currency }),
      'updated',
      'update',
    );

  const regenerateInvite = () =>
    report(
      () => updateGroup.mutateAsync({ groupId: id, regenerateInviteCode: true }),
      'inviteRegenerated',
      'regenerate',
    );

  const copyInvite = async () => {
    if (!group) return;
    await Clipboard.setStringAsync(group.invite_code);
    setStatus({ tone: 'positive', text: tGroupDetails('inviteCodeCopied') });
  };

  const shareInvite = () => {
    if (!group) return;
    Share.share({ message: `${INVITE_BASE_URL}/${group.invite_code}` });
  };

  const confirmLeave = () => {
    Alert.alert(t('leaveTitle'), t('leaveConfirmDesc'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('confirmLeave'),
        style: 'destructive',
        onPress: async () => {
          const ok = await report(() => leaveGroup.mutateAsync(id), 'left', 'leave');
          if (ok) router.dismissTo('/');
        },
      },
    ]);
  };

  const confirmRemove = (member: GroupMember) => {
    const memberName = member.group_nickname ?? member.profiles.display_name ?? '';
    Alert.alert(t('removeTitle', { name: memberName }), t('removeConfirmDesc'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('confirmRemove'),
        style: 'destructive',
        onPress: () =>
          report(
            () => removeMember.mutateAsync({ groupId: id, userId: member.user_id }),
            'memberRemoved',
            'removeMember',
          ),
      },
    ]);
  };

  const runDelete = async () => {
    const ok = await report(() => deleteGroup.mutateAsync(id), 'deleted', 'delete');
    if (ok) router.dismissTo('/');
  };

  const header = (
    <SheetHeader title={t('title')} closeLabel={t('cancel')} onClose={() => router.back()}>
      {status ? (
        <Text variant="subhead" color={status.tone} testID="settings-status">
          {status.text}
        </Text>
      ) : null}
    </SheetHeader>
  );

  if (!group) {
    return (
      <>
        {header}
        <Screen>
          <Skeleton height={160} radius={theme.radius.lg} />
          <Skeleton height={120} radius={theme.radius.lg} />
        </Screen>
      </>
    );
  }

  return (
    <>
      {header}
      <Screen>
        <Section title={t('coverImage')}>
          <View style={{ height: 140, borderRadius: theme.radius.md, overflow: 'hidden' }}>
            {group.cover_image_url ? (
              <Image
                source={{ uri: group.cover_image_url }}
                style={{ flex: 1 }}
                contentFit="cover"
                testID="group-cover"
              />
            ) : (
              <LinearGradient
                colors={[theme.colors.primary, theme.colors.settlement]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text variant="largeTitle" color="onPrimary">
                  {group.name.trim().charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Button
              testID="pick-cover"
              variant="secondary"
              title={t('addCover')}
              disabled={!isOwner}
              loading={uploadCover.isPending}
              onPress={pickCover}
              style={{ flex: 1 }}
            />
            {group.cover_image_url ? (
              <Button
                testID="remove-cover"
                variant="ghost"
                title={t('removeCover')}
                disabled={!isOwner}
                onPress={removeCover}
              />
            ) : null}
          </View>
        </Section>

        <Section title={t('title')}>
          <Input
            testID="group-name-input"
            label={t('name')}
            value={name}
            editable={isOwner}
            onChangeText={setNameDraft}
          />
          <CurrencyField
            testID="group-currency-field"
            label={t('baseCurrency')}
            value={currency}
            disabled={!isOwner || currencyLocked}
            hint={currencyLocked ? t('currencyLocked') : undefined}
            onChange={setCurrencyDraft}
          />
          <Button
            testID="save-group"
            title={t('save')}
            disabled={!isOwner || !dirty || name.trim().length === 0}
            loading={updateGroup.isPending}
            onPress={saveDetails}
          />
          {isOwner ? null : (
            <Text variant="footnote" color="textSecondary">
              {t('ownerOnly')}
            </Text>
          )}
        </Section>

        <Section title={t('inviteCode')}>
          <Text variant="title2" testID="invite-code">
            {group.invite_code}
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Button
              testID="copy-invite"
              variant="secondary"
              title={t('copy')}
              onPress={copyInvite}
              style={{ flex: 1 }}
            />
            <Button
              testID="share-invite"
              variant="secondary"
              title={t('share')}
              onPress={shareInvite}
              style={{ flex: 1 }}
            />
          </View>
          <Button
            testID="regenerate-invite"
            variant="ghost"
            title={t('regenerate')}
            disabled={!isOwner}
            onPress={regenerateInvite}
          />
          <Text variant="footnote" color="textSecondary">
            {t('regenerateDesc')}
          </Text>
        </Section>

        <Section title={t('members')}>
          {members.map((member) => {
            const memberName = member.group_nickname ?? member.profiles.display_name ?? '';
            const memberIsOwner = member.user_id === group.created_by;

            return (
              <View
                key={member.user_id}
                style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}
              >
                <Avatar
                  uri={member.group_avatar_url ?? member.profiles.avatar_url}
                  name={memberName}
                  size={40}
                />
                <View style={{ flex: 1 }}>
                  <Text variant="headline">{memberName}</Text>
                  {memberIsOwner ? (
                    <Text variant="footnote" color="textSecondary">
                      {t('owner')}
                    </Text>
                  ) : null}
                </View>
                {isOwner && !memberIsOwner ? (
                  <Button
                    testID={`remove-member-${member.user_id}`}
                    variant="ghost"
                    title={t('remove')}
                    onPress={() => confirmRemove(member)}
                  />
                ) : null}
              </View>
            );
          })}
          {isOwner ? null : (
            <Button
              testID="leave-group"
              variant="destructive"
              title={t('leave')}
              loading={leaveGroup.isPending}
              onPress={confirmLeave}
            />
          )}
        </Section>

        <Section title={t('dangerZone')}>
          <Button
            testID="toggle-hide"
            variant="secondary"
            title={isHidden ? t('unhide') : t('hide')}
            onPress={() =>
              report(
                () => hideGroup.mutateAsync({ groupId: id, hide: !isHidden }),
                isHidden ? 'unhidden' : 'hidden',
                isHidden ? 'unhide' : 'hide',
              )
            }
          />
          <Text variant="footnote" color="textSecondary">
            {isHidden ? t('unhideDesc') : t('hideDesc')}
          </Text>

          {isOwner ? (
            <>
              <Button
                testID="toggle-archive"
                variant="secondary"
                title={isArchived ? t('unarchive') : t('archive')}
                onPress={() =>
                  report(
                    () => archiveGroup.mutateAsync({ groupId: id, archive: !isArchived }),
                    isArchived ? 'unarchived' : 'archived',
                    isArchived ? 'unarchive' : 'archive',
                  )
                }
              />
              <Text variant="footnote" color="textSecondary">
                {isArchived ? t('unarchiveDesc') : t('archiveDesc')}
              </Text>

              <Input
                testID="delete-confirmation"
                label={t('deleteConfirmPrompt', { name: group.name })}
                value={deleteConfirmation}
                onChangeText={setDeleteConfirmation}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Button
                testID="delete-group"
                variant="destructive"
                title={t('delete')}
                disabled={deleteConfirmation !== group.name}
                loading={deleteGroup.isPending}
                onPress={runDelete}
              />
              <Text variant="footnote" color="textSecondary">
                {t('deleteConfirmDesc')}
              </Text>
            </>
          ) : null}
        </Section>
      </Screen>
    </>
  );
}
