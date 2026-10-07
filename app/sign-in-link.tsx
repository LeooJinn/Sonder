import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { describeError } from '../lib/errors';
import { PassportCover } from '../components/PassportCover';
import { Button, Notice } from '../components/ui';
import { colors, type } from '../lib/theme';

/**
 * Where the link in a "sign-in link" email lands:
 * /sign-in-link?token_hash=…&type=email.
 *
 * Opening the page signs nobody in; pressing the button does. A mail scanner
 * opens every link in a message, and one that signed in or spent the token on
 * being opened would be useless to the person it was sent to (the same reason
 * as /reset-password and /confirm-email). The route guard moves a signed-in
 * visitor on from here once the session arrives.
 */
export default function SignInLinkScreen() {
  const params = useLocalSearchParams<{ token_hash?: string; type?: string }>();
  const router = useRouter();
  const tokenHash = typeof params.token_hash === 'string' ? params.token_hash : '';
  const linkLooksRight = tokenHash.length > 0 && params.type === 'email';

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dead, setDead] = useState(false);

  async function signIn() {
    setError(null);
    setBusy(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
    setBusy(false);
    if (verifyError) {
      // A server we could not reach is worth retrying; anything else means the link is spent.
      const message = describeError(verifyError);
      if (message !== verifyError.message) setError(message);
      else setDead(true);
      return;
    }
    router.replace('/');
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <Stack.Screen options={{ headerShown: false, title: 'Sign in' }} />
      <PassportCover />

      {dead || !linkLooksRight ? (
        <View style={styles.block}>
          <Text style={styles.title} accessibilityRole="header">
            This link isn&apos;t valid any more
          </Text>
          <Text style={styles.body}>
            Sign-in links work once and expire after an hour. It may also have been cut short when
            it was copied. Ask for a new one and use the link in the newest email.
          </Text>
          <Button label="Send me a new link" onPress={() => router.replace('/sign-in?mode=link')} glint />
        </View>
      ) : (
        <View style={styles.block}>
          <Text style={styles.title} accessibilityRole="header">
            Sign in to Sonder
          </Text>
          <Text style={styles.body}>Press the button to sign in. No password needed.</Text>
          {error && <Notice tone="error">{error}</Notice>}
          <Button label="Sign in" onPress={signIn} busy={busy} glint />
        </View>
      )}
    </ScrollView>
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
});
