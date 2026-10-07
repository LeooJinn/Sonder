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
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { describeError } from '../lib/errors';
import { PassportCover } from '../components/PassportCover';
import { Button, Field, Notice, focusRing, type PressState } from '../components/ui';
import { colors, fonts, radius, type } from '../lib/theme';

type Mode = 'signIn' | 'signUp' | 'reset';

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
  // /sign-in?mode=signup opens on Create account: the front page's
  // "Start a passport" is for people who don't have one yet. ?mode=reset
  // opens on "Forgot password", where an expired reset link sends people.
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(
    params.mode === 'signup' ? 'signUp' : params.mode === 'reset' ? 'reset' : 'signIn'
  );
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
  const isReset = mode === 'reset';

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

  async function handleReset() {
    if (cooldown > 0) return;
    setError(null);
    setNotice(null);

    if (!email.trim()) {
      setError('Enter the email you signed up with.');
      return;
    }

    setBusy(true);
    // The link in the email is built by the template (supabase/email-templates/
    // reset-password.html), so there is no redirect to pass here.
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());
    setBusy(false);

    if (resetError) {
      setError(describeError(resetError));
      return;
    }
    // The same answer whether or not an account exists, so this form can't be
    // used to find out who has one.
    setNotice(
      `If there is an account for ${email.trim()}, a link to choose a new password is on its way. Check your spam folder too.`
    );
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  async function handleSubmit() {
    if (isReset) return handleReset();
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
        <PassportCover />

        {!isReset && (
          <Text style={styles.lead}>
            A logbook that stays with the car. Mods, service and repairs, handed to the next owner
            when it sells.
          </Text>
        )}

        {isReset ? (
          <View style={styles.resetHead}>
            <Text style={styles.resetTitle} accessibilityRole="header">
              Reset your password
            </Text>
            <Text style={styles.resetBody}>
              Enter your email and we will send a link to choose a new one.
            </Text>
          </View>
        ) : (
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
        )}

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

        {!isReset && (
          <>
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
                variant="subtle"
                onPress={() => setShowPassword((v) => !v)}
              />
            }
          />

            {!isSignUp && (
              <Button
                label="Forgot password?"
                variant="subtle"
                onPress={() => switchMode('reset')}
                style={styles.forgot}
              />
            )}
          </>
        )}

        {error && <Notice tone="error">{error}</Notice>}
        {notice && <Notice tone="success">{notice}</Notice>}

        {unconfirmedEmail && !isReset && (
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
          label={
            isReset
              ? cooldown > 0
                ? `Send again in ${cooldown}s`
                : 'Send reset link'
              : isSignUp
                ? 'Create account'
                : 'Sign in'
          }
          onPress={handleSubmit}
          busy={busy}
          disabled={isReset && cooldown > 0}
          style={styles.submit}
          glint
        />

        {isReset && (
          <Button
            label="Back to sign in"
            variant="quiet"
            onPress={() => switchMode('signIn')}
            style={styles.back}
          />
        )}

        <Link href="/welcome" style={styles.about}>
          What is Sonder?
        </Link>
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
  tabText: { fontFamily: fonts.bodyMedium, fontSize: type.compact.fontSize, color: colors.textMuted },
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

  resetHead: { gap: 8, marginBottom: 24 },
  resetTitle: { ...type.bodyStrong, color: colors.text },
  resetBody: { ...type.small, color: colors.textMuted },
  forgot: { alignSelf: 'flex-end', marginTop: -8, marginBottom: 8 },

  submit: { marginTop: 8 },
  back: { marginTop: 12 },
  about: {
    alignSelf: 'center',
    marginTop: 28,
    paddingVertical: 12,
    fontFamily: fonts.bodySemi,
    fontSize: type.compact.fontSize,
    color: colors.textMuted,
  },
});
