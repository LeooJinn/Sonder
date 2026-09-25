import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { supabase } from '../lib/supabase';
import { describeError } from '../lib/errors';
import { Button, Field, Notice, focusRing, type PressState } from '../components/ui';
import { colors, fonts, radius, type } from '../lib/theme';

type Mode = 'signIn' | 'signUp';

/** Supabase's own rate limit on resends. Matching it avoids a confusing error. */
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Whether a failed sign-in failed because the address was never confirmed.
 * Checks the code first and falls back to the message, since the code was
 * added later and older responses only carry text.
 */
function isUnconfirmedEmailError(error: { code?: string; message: string }): boolean {
  return error.code === 'email_not_confirmed' || /not confirmed/i.test(error.message);
}

export default function SignInScreen() {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Set when an address exists but hasn't been confirmed, which is what the resend acts on. */
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const isSignUp = mode === 'signUp';

  // Ticks the cooldown down once a second. Re-running on each change is what
  // makes it a countdown; the cleanup stops it when the screen goes away.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleResend() {
    if (!unconfirmedEmail || cooldown > 0 || resending) return;

    setError(null);
    setNotice(null);
    setResending(true);

    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: unconfirmedEmail,
    });

    if (resendError) {
      setError(describeError(resendError));
    } else {
      setNotice(`New confirmation link sent to ${unconfirmedEmail}.`);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }

    setResending(false);
  }

  async function handleSubmit() {
    setError(null);
    setNotice(null);

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (isSignUp && password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }

    setBusy(true);

    // On success the auth listener in AuthProvider picks up the new session
    // and the guard in _layout navigates away. Nothing to do here but stop.
    const { data, error: authError } = isSignUp
      ? await supabase.auth.signUp({ email: email.trim(), password })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (authError) {
      // A sign-in blocked purely by an unconfirmed address isn't a dead end —
      // offer the resend rather than leaving the person stuck at an error.
      if (isUnconfirmedEmailError(authError)) {
        setUnconfirmedEmail(email.trim());
        setError("That email hasn't been confirmed yet.");
      } else {
        setError(describeError(authError));
      }
      setBusy(false);
      return;
    }

    // Sign-up returns a user but no session when email confirmation is on.
    // That isn't an error — the account exists, it just isn't usable yet.
    if (isSignUp && !data.session) {
      setNotice(`Account created. Check ${email.trim()} for a confirmation link, then sign in.`);
      setUnconfirmedEmail(email.trim());
      setMode('signIn');
      setPassword('');
    }

    setBusy(false);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
    setUnconfirmedEmail(null);
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false, title: 'Sign in' }} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* The cover. Laid out like a passport's: centred, foil, one line
            saying what the document is. */}
        <View style={styles.cover}>
          <View style={styles.coverRule} />
          <Text style={styles.wordmark} accessibilityRole="header">
            Sonder
          </Text>
          <Text style={styles.docType}>Vehicle passport</Text>
          <View style={styles.coverRule} />
        </View>

        <Text style={styles.lead}>
          A logbook that stays with the car. Mods, service and repairs, handed to the next owner
          when it sells.
        </Text>

        <View style={styles.tabs} accessibilityRole="tablist">
          {(['signIn', 'signUp'] as const).map((option) => {
            const selected = mode === option;
            return (
              <Pressable
                key={option}
                onPress={() => switchMode(option)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                style={(state) => [
                  styles.tab,
                  selected && styles.tabSelected,
                  (state as PressState).focused && focusRing,
                ]}
              >
                <Text style={[styles.tabText, selected && styles.tabTextSelected]}>
                  {option === 'signIn' ? 'Sign in' : 'Create account'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Field
          label="Email"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            // The resend targets a specific address. Once the field no longer
            // matches it, offering to resend would send to the old one.
            if (unconfirmedEmail && text.trim() !== unconfirmedEmail) {
              setUnconfirmedEmail(null);
            }
          }}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
        />

        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder={isSignUp ? 'At least 8 characters' : 'Your password'}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType={isSignUp ? 'newPassword' : 'password'}
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          onSubmitEditing={handleSubmit}
          accessory={
            <Button
              label={showPassword ? 'Hide' : 'Show'}
              variant="quiet"
              onPress={() => setShowPassword((v) => !v)}
            />
          }
        />

        {error && <Notice tone="error">{error}</Notice>}
        {notice && <Notice tone="success">{notice}</Notice>}

        {unconfirmedEmail && (
          <View style={styles.resend}>
            <Text style={styles.resendTitle}>Didn&apos;t get the email?</Text>
            <Text style={styles.resendBody}>
              Check your spam folder first. Confirmation emails often land there.
            </Text>
            <Button
              variant="quiet"
              onPress={handleResend}
              disabled={cooldown > 0 || resending}
              label={
                resending
                  ? 'Sending…'
                  : cooldown > 0
                    ? `Resend available in ${cooldown}s`
                    : 'Resend confirmation email'
              }
            />
          </View>
        )}

        <Button
          label={isSignUp ? 'Create account' : 'Sign in'}
          onPress={handleSubmit}
          busy={busy}
          style={styles.submit}
        />
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

  cover: { alignItems: 'center', gap: 14, marginBottom: 40 },
  coverRule: { width: 56, height: 1, backgroundColor: colors.accent, opacity: 0.6 },
  wordmark: {
    fontFamily: fonts.displayBold,
    fontSize: 80,
    lineHeight: 78,
    color: colors.accent,
    letterSpacing: 1,
  },
  docType: { fontFamily: fonts.display, fontSize: 18, color: colors.accent, letterSpacing: 1 },

  lead: { ...type.lead, color: colors.textMuted, textAlign: 'center', marginBottom: 36 },

  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.control,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabSelected: { backgroundColor: colors.background },
  tabText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.textMuted },
  tabTextSelected: { fontFamily: fonts.bodySemi, color: colors.text },

  resend: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    padding: 16,
    marginBottom: 16,
    gap: 6,
  },
  resendTitle: { ...type.bodyStrong, color: colors.text },
  resendBody: { ...type.small, color: colors.textMuted, marginBottom: 4 },

  submit: { marginTop: 8 },
});
