import { useState } from 'react';
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

export default function SignInScreen() {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignUp = mode === 'signUp';

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
      setError(authError.message);
      setBusy(false);
      return;
    }

    // Sign-up returns a user but no session when email confirmation is on.
    // That isn't an error — the account exists, it just isn't usable yet.
    if (isSignUp && !data.session) {
      setNotice(`Account created. Check ${email.trim()} for a confirmation link, then sign in.`);
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
            onChangeText={setEmail}
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
