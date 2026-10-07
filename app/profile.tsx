import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { loadMyProfile, updateMyProfile } from '../lib/profile';
import { signOut } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { RegionPicker } from '../components/RegionPicker';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AccountSecurity } from '../components/AccountSecurity';
import { deleteAccount } from '../lib/account';
import { loadBlocked, unblockMember, type BlockedMember } from '../lib/moderation';
import { loadMyFollowers, type Follower } from '../lib/follows';
import { loadMessageEmails, setMessageEmails } from '../lib/messages';
import { loadReminderEmails, setReminderEmails } from '../lib/reminders';
import { ownerName } from '../components/Timeline';
import { regionLabel } from '../lib/regions';
import { Button, Field, Notice } from '../components/ui';
import { colors, column, fonts, radius, type } from '../lib/theme';

function EmailSwitchRow({
  title,
  hint,
  value,
  onValueChange,
}: {
  title: string;
  hint: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchText}>
        <Text style={styles.emailsTitle}>{title}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={title}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={colors.paper}
        {...(Platform.OS === 'web' ? { activeThumbColor: colors.paper } : {})}
      />
    </View>
  );
}

export default function ProfileScreen() {
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [region, setRegion] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [askingDelete, setAskingDelete] = useState(false);
  const [blocked, setBlocked] = useState<BlockedMember[]>([]);
  const [followers, setFollowers] = useState<Follower[]>([]);
  // Null until known, so the switch doesn't flash the wrong way.
  const [messageEmails, setMessageEmailsOn] = useState<boolean | null>(null);
  const [reminderEmails, setReminderEmailsOn] = useState<boolean | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  // The handle as stored, not as typed: the page link must point somewhere real.
  const [savedHandle, setSavedHandle] = useState('');
  const router = useRouter();

  useEffect(() => {
    loadBlocked().then(setBlocked).catch(() => {});
    loadMyFollowers().then(setFollowers).catch(() => {});
    loadMessageEmails().then(setMessageEmailsOn).catch(() => {});
    loadReminderEmails().then(setReminderEmailsOn).catch(() => {});
  }, []);

  async function toggleEmails(
    next: boolean,
    setShown: (on: boolean) => void,
    save: (on: boolean) => Promise<void>
  ) {
    // Flips at once and goes back if it didn't save, like the public-link switch.
    setShown(next);
    setEmailError(null);
    try {
      await save(next);
    } catch (e) {
      setShown(!next);
      setEmailError(e instanceof Error ? e.message : 'That did not save. Try again.');
    }
  }

  useEffect(() => {
    Promise.all([loadMyProfile(), supabase.auth.getUser()])
      .then(([profile, auth]) => {
        setHandle(profile.handle ?? '');
        setSavedHandle(profile.handle ?? '');
        setDisplayName(profile.displayName ?? '');
        setRegion(profile.region ?? '');
        setEmail(auth.data.user?.email ?? '');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your profile.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setError(null);
    setSaved(false);
    setSaving(true);

    try {
      await updateMyProfile({ handle, displayName, region });
      setSavedHandle(handle.trim().toLowerCase());
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Stack.Screen options={{ title: 'Profile' }} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const shownAs = displayName.trim() || (handle ? `@${handle}` : 'A Sonder owner');
  const regionName = regionLabel(region);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Profile' }} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* What strangers see on a shared passport, updated as you type. */}
        <View style={styles.preview}>
          <Text style={styles.previewLabel}>On your passports</Text>
          <Text style={styles.previewLine}>
            Kept by {shownAs}
            {regionName ? ` in ${regionName}` : ''}
          </Text>
        </View>
        {savedHandle ? (
          <View style={styles.previewAction}>
            <Button label="See your page" variant="quiet" onPress={() => router.push(`/u/${savedHandle}`)} />
          </View>
        ) : null}

        <Field
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Leo"
          hint="Shown against the work you log."
          autoComplete="name"
        />

        <Field
          label="Handle"
          value={handle}
          onChangeText={(text) => setHandle(text.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          placeholder="leo"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          isMono
          hint={
            handle
              ? `Your page is imsonder.com/u/${handle}. People follow you there.`
              : 'Lowercase letters, numbers and underscores. Without one, people can follow your cars but not you.'
          }
        />

        <View style={styles.field}>
          <Text style={styles.label}>Region</Text>
          <RegionPicker value={region} onChange={setRegion} />
          <Text style={styles.hint}>Region only, never an address. Cars get stolen.</Text>
        </View>

        {error && <Notice tone="error">{error}</Notice>}
        {saved && <Notice tone="success">Profile saved.</Notice>}

        <Button label="Save profile" onPress={handleSave} busy={saving} />

        {(messageEmails !== null || reminderEmails !== null) && (
          <View style={styles.emails}>
            {messageEmails !== null && (
              <EmailSwitchRow
                title="Email me about unread messages"
                hint="At most one email per conversation every few hours, and only if you haven't read the messages in Sonder. It says who wrote, never what they said."
                value={messageEmails}
                onValueChange={(next) => toggleEmails(next, setMessageEmailsOn, setMessageEmails)}
              />
            )}
            {reminderEmails !== null && (
              <EmailSwitchRow
                title="Email me when a reminder is due"
                hint="At most one email a week, listing what has come due on your cars. It names the car and the reminder, never a date or a mileage."
                value={reminderEmails}
                onValueChange={(next) => toggleEmails(next, setReminderEmailsOn, setReminderEmails)}
              />
            )}
            {emailError ? <Text style={styles.emailError}>{emailError}</Text> : null}
          </View>
        )}

        <View style={styles.account}>
          <Text style={styles.accountLabel}>Signed in as</Text>
          <Text style={styles.email}>{email}</Text>
          <AccountSecurity email={email} />
          <Button
            label="Sign out"
            variant="secondary"
            onPress={async () => {
              await signOut();
              router.replace('/sign-in');
            }}
          />
        </View>

        {followers.length > 0 && (
          <View style={styles.blocked}>
            <Text style={styles.dangerTitle}>
              {followers.length} {followers.length === 1 ? 'person follows' : 'people follow'} you
            </Text>
            <Text style={styles.dangerBody}>Only you can see who they are.</Text>
            {followers.map((person) => (
              <View key={person.id} style={styles.blockedRow}>
                <Text style={styles.blockedName}>{ownerName(person, 'A member')}</Text>
                {person.handle ? (
                  <Button label="Their page" variant="subtle" onPress={() => router.push(`/u/${person.handle}`)} />
                ) : null}
              </View>
            ))}
          </View>
        )}

        {blocked.length > 0 && (
          <View style={styles.blocked}>
            <Text style={styles.dangerTitle}>Blocked members</Text>
            <Text style={styles.dangerBody}>
              You don&apos;t see their meets or the cars they sell. They haven&apos;t been told.
            </Text>
            {blocked.map((member) => (
              <View key={member.id} style={styles.blockedRow}>
                <Text style={styles.blockedName}>{ownerName(member, 'A member')}</Text>
                <Button
                  label="Unblock"
                  variant="subtle"
                  onPress={async () => {
                    await unblockMember(member.id);
                    setBlocked((current) => current.filter((m) => m.id !== member.id));
                  }}
                />
              </View>
            ))}
          </View>
        )}

        <View style={styles.danger}>
          <Text style={styles.dangerTitle}>Delete account</Text>
          <Text style={styles.dangerBody}>
            Your account, profile and any cars still in your garage are deleted permanently.
            Cars you sold keep their history for their current owner, with your name removed.
          </Text>
          <Button label="Delete my account" variant="danger" onPress={() => setAskingDelete(true)} />
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={askingDelete}
        title="Delete your account?"
        body="This cannot be undone. You will be signed out immediately and will not be able to sign back in with this email."
        consequences={[
          'Your profile and handle are released',
          'Cars still in your garage are deleted, with their logs and photos',
          'Cars you sold keep their history, with your name removed',
        ]}
        confirmLabel="Delete account"
        confirmPhrase="DELETE MY ACCOUNT"
        onConfirm={async () => {
          await deleteAccount();
          router.replace('/sign-in');
        }}
        onCancel={() => setAskingDelete(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 56, ...column },

  preview: {
    backgroundColor: colors.paper,
    borderRadius: radius.page,
    padding: 18,
    marginBottom: 28,
  },
  previewLabel: { ...type.caption, color: colors.inkMuted },
  previewAction: { marginTop: -12, marginBottom: 28, paddingHorizontal: 4 },
  previewLine: { fontFamily: fonts.bodyMedium, fontSize: 17, lineHeight: 24, color: colors.ink, marginTop: 4 },

  field: { marginBottom: 24 },
  label: { ...type.label, color: colors.textMuted, marginBottom: 8 },
  hint: { ...type.caption, color: colors.textFaint, marginTop: 8 },

  emails: { marginTop: 40, paddingTop: 24, gap: 24, borderTopWidth: 1, borderTopColor: colors.border },
  switchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  switchText: { flex: 1, gap: 4 },
  emailsTitle: { ...type.bodyStrong, color: colors.text },
  emailError: { ...type.caption, color: colors.danger, marginTop: 8 },

  account: {
    marginTop: 40,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  accountLabel: { ...type.caption, color: colors.textFaint },
  email: { ...type.body, color: colors.text, marginTop: 2, marginBottom: 16 },

  blocked: {
    marginTop: 40,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  blockedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  blockedName: { ...type.bodyStrong, color: colors.text },

  danger: {
    marginTop: 40,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  dangerTitle: { ...type.heading, color: colors.text },
  dangerBody: { ...type.small, color: colors.textMuted, marginBottom: 8 },
});
