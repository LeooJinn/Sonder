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
import { Stack } from 'expo-router';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';

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
      setError(resendError.message);
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
        setError(authError.message);
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

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Text style={styles.wordmark}>SONDER</Text>
          <Text style={styles.tagline}>Every car has a life of its own.</Text>
        </View>

        <Text style={styles.heading}>{isSignUp ? 'Create your account' : 'Welcome back'}</Text>
        <Text style={styles.sub}>
          {isSignUp
            ? 'Your garage and build logs stay with your account.'
            : 'Sign in to pick up where you left off.'}
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
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
            placeholderTextColor={colors.disabled}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
        </View>

        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Password</Text>
            <Pressable onPress={() => setShowPassword((v) => !v)}>
              <Text style={styles.toggle}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder={isSignUp ? 'At least 8 characters' : 'Your password'}
            placeholderTextColor={colors.disabled}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType={isSignUp ? 'newPassword' : 'password'}
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
        {notice && <Text style={styles.notice}>{notice}</Text>}

        {unconfirmedEmail && (
          <View style={styles.resend}>
            <Text style={styles.resendTitle}>Didn&apos;t get the email?</Text>
            <Text style={styles.resendBody}>
              Check your spam folder first — confirmation emails often land there.
            </Text>
            <Pressable
              onPress={handleResend}
              disabled={cooldown > 0 || resending}
              hitSlop={8}
            >
              <Text
                style={[
                  styles.resendAction,
                  (cooldown > 0 || resending) && styles.resendActionDisabled,
                ]}
              >
                {resending
                  ? 'Sending…'
                  : cooldown > 0
                    ? `Resend available in ${cooldown}s`
                    : 'Resend confirmation email'}
              </Text>
            </Pressable>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.submit,
            pressed && styles.submitPressed,
            busy && styles.submitDisabled,
          ]}
          onPress={handleSubmit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.submitText}>{isSignUp ? 'Create account' : 'Sign in'}</Text>
          )}
        </Pressable>

        <View style={styles.switch}>
          <Text style={styles.switchText}>
            {isSignUp ? 'Already have an account?' : 'New to Sonder?'}
          </Text>
          <Pressable
            onPress={() => {
              setMode(isSignUp ? 'signIn' : 'signUp');
              setError(null);
              setNotice(null);
              setUnconfirmedEmail(null);
            }}
          >
            <Text style={styles.switchLink}>{isSignUp ? 'Sign in' : 'Create an account'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 28, paddingTop: 80, paddingBottom: 48, maxWidth: 460, width: '100%', alignSelf: 'center' },

  brand: { marginBottom: 56 },
  wordmark: { color: colors.text, fontSize: 26, fontWeight: '700', letterSpacing: 5 },
  tagline: { color: colors.textFaint, fontSize: 13, marginTop: 6 },

  heading: { color: colors.text, fontSize: 28, fontWeight: '700' },
  sub: { color: colors.textMuted, fontSize: 15, marginTop: 6, marginBottom: 32, lineHeight: 21 },

  field: { marginBottom: 18 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  toggle: { color: colors.accent, fontSize: 12, fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    color: colors.text,
    fontSize: 16,
    padding: 14,
  },

  error: { color: colors.accent, fontSize: 14, marginBottom: 12, lineHeight: 20 },

  resend: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 16,
    marginBottom: 12,
    gap: 6,
  },
  resendTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  resendBody: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  resendAction: { color: colors.accent, fontSize: 14, fontWeight: '600', marginTop: 4 },
  resendActionDisabled: { color: colors.textFaint },
  notice: { color: '#8FBF7F', fontSize: 14, marginBottom: 12, lineHeight: 20 },

  submit: {
    backgroundColor: colors.accent,
    borderRadius: 4,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  submitPressed: { opacity: 0.8 },
  submitDisabled: { backgroundColor: colors.disabled },
  submitText: { color: colors.background, fontSize: 15, fontWeight: '700', letterSpacing: 1 },

  switch: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 28 },
  switchText: { color: colors.textMuted, fontSize: 14 },
  switchLink: { color: colors.accent, fontSize: 14, fontWeight: '600' },
});
