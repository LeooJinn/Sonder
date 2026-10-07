import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { describeError } from '../lib/errors';
import { PassportCover } from '../components/PassportCover';
import { Button, Field, Notice } from '../components/ui';
import { colors, type } from '../lib/theme';

/**
 * Where the link in the reset email lands: /reset-password?token_hash=…&type=recovery.
 *
 * Opening the page does nothing to the link. The token is only used when a new
 * password is submitted, because mail scanners open every link in a message
 * and a link that is used up by being opened would reach people already dead.
 * (The same reason /api/unsubscribe only acts on POST.)
 *
 * Using the token signs the person in; setting the password follows at once.
 * If setting it fails after that (a password Supabase refuses), the token is
 * spent but the session is real, so a second try skips straight to setting it.
 */
export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token_hash?: string; type?: string }>();
  const router = useRouter();
  const tokenHash = typeof params.token_hash === 'string' ? params.token_hash : '';
  const linkLooksRight = tokenHash.length > 0 && params.type === 'recovery';

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** True once the token has been used, so a retry doesn't try it again. */
  const [signedIn, setSignedIn] = useState(false);
  /** The link was used up or expired: the only way on is to ask for another. */
  const [linkDead, setLinkDead] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }

    setBusy(true);
    if (!signedIn) {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'recovery',
      });
      if (verifyError) {
        setBusy(false);
        // Network trouble is worth retrying; anything else means the link is spent.
        const unreachable = describeError(verifyError) !== verifyError.message;
        if (unreachable) setError(describeError(verifyError));
        else setLinkDead(true);
        return;
      }
      setSignedIn(true);
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(describeError(updateError));
      return;
    }
    // Signed in with the new password: on to the garage.
    router.replace('/');
  }

  const dead = !linkLooksRight || linkDead;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false, title: 'Reset password' }} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <PassportCover />

        {dead ? (
          <View style={styles.block}>
            <Text style={styles.title} accessibilityRole="header">
              This link isn&apos;t valid any more
            </Text>
            <Text style={styles.body}>
              Reset links work once and expire after an hour. It may also have been cut short when
              it was copied. Ask for a new one and use the link in the newest email.
            </Text>
            <Button
              label="Send me a new link"
              onPress={() => router.replace('/sign-in?mode=reset')}
              glint
            />
          </View>
        ) : (
          <View style={styles.block}>
            <Text style={styles.title} accessibilityRole="header">
              Choose a new password
            </Text>
            <Text style={styles.body}>You will be signed in once it is saved.</Text>

            <Field
              label="New password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              autoComplete="new-password"
              onSubmitEditing={handleSubmit}
              accessory={
                <Button
                  label={showPassword ? 'Hide' : 'Show'}
                  variant="subtle"
                  onPress={() => setShowPassword((v) => !v)}
                />
              }
            />

            {error && <Notice tone="error">{error}</Notice>}

            <Button label="Save new password" onPress={handleSubmit} busy={busy} style={styles.submit} glint />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: 24,
    paddingTop: 72,
    paddingBottom: 48,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  block: { gap: 12 },
  title: { ...type.bodyStrong, color: colors.text },
  body: { ...type.small, color: colors.textMuted, marginBottom: 8 },
  submit: { marginTop: 8 },
});
