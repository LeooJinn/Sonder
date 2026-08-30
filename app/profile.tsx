import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { loadMyProfile, updateMyProfile } from '../lib/profile';
import { signOut } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { RegionPicker } from '../components/RegionPicker';
import { colors, mono } from '../lib/theme';

export default function ProfileScreen() {
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [region, setRegion] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
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

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Profile' }} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.email}>{email}</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Handle</Text>
          <TextInput
            style={[styles.input, styles.inputMono]}
            value={handle}
            onChangeText={(text) => setHandle(text.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder="leo"
            placeholderTextColor={colors.disabled}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
          />
          <Text style={styles.hint}>
            Lowercase letters, numbers and underscores. This appears in the link when you
            share a build.
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Display name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Leo"
            placeholderTextColor={colors.disabled}
          />
          <Text style={styles.hint}>Shown against the work you log.</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Region</Text>
          <RegionPicker value={region} onChange={setRegion} />
          <Text style={styles.hint}>
            Region only — never a precise address. Cars get stolen.
          </Text>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
        {saved && <Text style={styles.saved}>Profile saved.</Text>}

        <Pressable
          style={({ pressed }) => [
            styles.save,
            pressed && styles.savePressed,
            saving && styles.saveDisabled,
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.saveText}>Save profile</Text>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.signOut, pressed && styles.savePressed]}
          onPress={async () => {
            await signOut();
            router.replace('/sign-in');
          }}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 48 },

  label: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  email: { color: colors.text, fontSize: 15, marginBottom: 28 },

  field: { marginBottom: 22 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    color: colors.text,
    fontSize: 16,
    padding: 13,
  },
  inputMono: { fontFamily: mono, letterSpacing: 1 },
  hint: { color: colors.textFaint, fontSize: 12, marginTop: 7, lineHeight: 17 },

  error: { color: colors.accent, fontSize: 14, marginBottom: 12, lineHeight: 20 },
  saved: { color: '#8FBF7F', fontSize: 14, marginBottom: 12 },

  save: {
    backgroundColor: colors.accent,
    borderRadius: 4,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  savePressed: { opacity: 0.8 },
  saveDisabled: { backgroundColor: colors.disabled },
  saveText: { color: colors.background, fontSize: 15, fontWeight: '700', letterSpacing: 1 },

  signOut: { marginTop: 28, paddingVertical: 12, alignItems: 'center' },
  signOutText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
});
