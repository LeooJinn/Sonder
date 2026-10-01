import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import { describeError } from '../lib/errors';
import { loadMessageAccess, startConversation, type MessageAccess } from '../lib/messages';
import { colors, type } from '../lib/theme';
import { Button } from './ui';

/**
 * "Message" on a member's page, for someone you follow who follows you back.
 *
 * Messaging is only between members who follow each other, so for someone
 * you follow who hasn't followed back this says when it will work rather than
 * showing nothing. For everyone else it shows nothing: there's no way in, and
 * a disabled button would only ask why.
 *
 * `refreshKey` changes when the follow button flips, so the answer follows it.
 */
export function MessageButton({
  memberId,
  name,
  refreshKey,
}: {
  memberId: string;
  name: string;
  refreshKey?: number;
}) {
  const { session } = useAuth();
  const router = useRouter();
  const [access, setAccess] = useState<MessageAccess | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let live = true;
    loadMessageAccess(memberId)
      .then((next) => live && setAccess(next))
      .catch(() => live && setAccess(null));
    return () => {
      live = false;
    };
  }, [session, memberId, refreshKey]);

  if (!session || !access) return null;

  if (!access.canMessage) {
    return access.iFollow && !access.followsMe ? (
      <Text style={styles.hint}>You can message {name} once they follow you back.</Text>
    ) : null;
  }

  async function open() {
    setBusy(true);
    setError(null);
    try {
      router.push(`/messages/${await startConversation(memberId)}`);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <Button
        label="Message"
        variant="secondary"
        busy={busy}
        onPress={open}
        accessibilityHint={`Opens your conversation with ${name}`}
        style={styles.button}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: { minWidth: 124 },
  hint: { ...type.small, color: colors.textMuted },
  error: { ...type.caption, color: colors.danger, marginTop: 8 },
});
