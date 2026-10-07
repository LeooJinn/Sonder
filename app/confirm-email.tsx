import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { confirmEmailChange } from '../lib/account';
import { describeError } from '../lib/errors';
import { PassportCover } from '../components/PassportCover';
import { Button, Notice } from '../components/ui';
import { colors, type } from '../lib/theme';

type Result = { email?: string; waitingForOther: boolean };

/**
 * Where the link in a change-email message lands:
 * /confirm-email?token_hash=…&type=email_change.
 *
 * Like /reset-password, opening the page does nothing; the token is used when
 * the button is pressed, so a mail scanner opening the link cannot spend it.
 * With both addresses to confirm, each gets its own link, and this page says
 * when one more is needed.
 */
export default function ConfirmEmailScreen() {
  const params = useLocalSearchParams<{ token_hash?: string; type?: string }>();
  const router = useRouter();
  const tokenHash = typeof params.token_hash === 'string' ? params.token_hash : '';
  const linkLooksRight = tokenHash.length > 0 && params.type === 'email_change';

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dead, setDead] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function confirm() {
    setError(null);
    setBusy(true);
    try {
      setResult(await confirmEmailChange(tokenHash));
    } catch (e) {
      const message = describeError(e);
      // A server we could not reach is worth retrying; anything else means the link is spent.
      if (e instanceof Error && message !== e.message) setError(message);
      else setDead(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <Stack.Screen options={{ headerShown: false, title: 'Confirm email' }} />
      <PassportCover />

      {result ? (
        <View style={styles.block}>
          <Text style={styles.title} accessibilityRole="header">
            {result.waitingForOther ? 'One more step' : 'Your email is changed'}
          </Text>
          <Text style={styles.body}>
            {result.waitingForOther
              ? 'That address is confirmed. Open the message sent to your other address and follow its link too. The change finishes once both are done.'
              : `Your Sonder email is now ${result.email ?? 'the new address'}. Use it the next time you sign in.`}
          </Text>
          <Button label="Go to your garage" onPress={() => router.replace('/')} glint />
        </View>
      ) : dead || !linkLooksRight ? (
        <View style={styles.block}>
          <Text style={styles.title} accessibilityRole="header">
            This link isn&apos;t valid any more
          </Text>
          <Text style={styles.body}>
            Confirmation links work once and expire after an hour. It may also have been cut short
            when it was copied. Start the change again from Profile and use the newest messages.
          </Text>
          <Button label="Go to your garage" onPress={() => router.replace('/')} glint />
        </View>
      ) : (
        <View style={styles.block}>
          <Text style={styles.title} accessibilityRole="header">
            Confirm your new email
          </Text>
          <Text style={styles.body}>Press the button to finish changing the email on your Sonder account.</Text>
          {error && <Notice tone="error">{error}</Notice>}
          <Button label="Confirm email change" onPress={confirm} busy={busy} glint />
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
