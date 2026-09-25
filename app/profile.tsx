import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { loadMyProfile, updateMyProfile } from '../lib/profile';
import { signOut } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { RegionPicker } from '../components/RegionPicker';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { deleteAccount } from '../lib/account';
import { regionLabel } from '../lib/regions';
import { Button, Field, Notice } from '../components/ui';
import { colors, column, fonts, radius, type } from '../lib/theme';

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
  const router = useRouter();

  useEffect(() => {
    Promise.all([loadMyProfile(), supabase.auth.getUser()])
      .then(([profile, auth]) => {
        setHandle(profile.handle ?? '');
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
          hint="Lowercase letters, numbers and underscores. Used when you have no display name."
        />

        <View style={styles.field}>
          <Text style={styles.label}>Region</Text>
          <RegionPicker value={region} onChange={setRegion} />
          <Text style={styles.hint}>Region only, never an address. Cars get stolen.</Text>
        </View>

        {error && <Notice tone="error">{error}</Notice>}
        {saved && <Notice tone="success">Profile saved.</Notice>}

        <Button label="Save profile" onPress={handleSave} busy={saving} />

        <View style={styles.account}>
          <Text style={styles.accountLabel}>Signed in as</Text>
          <Text style={styles.email}>{email}</Text>
          <Button
            label="Sign out"
            variant="secondary"
            onPress={async () => {
              await signOut();
              router.replace('/sign-in');
            }}
          />
        </View>

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
  previewLine: { fontFamily: fonts.bodyMedium, fontSize: 17, lineHeight: 24, color: colors.ink, marginTop: 4 },

  field: { marginBottom: 24 },
  label: { ...type.label, color: colors.textMuted, marginBottom: 8 },
  hint: { ...type.caption, color: colors.textFaint, marginTop: 8 },

  account: {
    marginTop: 40,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  accountLabel: { ...type.caption, color: colors.textFaint },
  email: { ...type.body, color: colors.text, marginTop: 2, marginBottom: 16 },

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
