import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, mono } from '../lib/theme';

/**
 * A confirmation someone has to mean.
 *
 * Tapping twice is not a confirmation — the second tap lands in the same place
 * as the first, so a double tap sails straight through it. This puts the
 * consequences in front of the person, moves the confirm button somewhere
 * their finger isn't already, and for the worst actions makes them type a
 * phrase, which cannot be done by accident.
 */
export function ConfirmDialog({
  visible,
  title,
  body,
  consequences,
  confirmLabel,
  confirmPhrase,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  body: string;
  /** Concrete things that will be destroyed. Counts, not vague warnings. */
  consequences?: string[];
  confirmLabel: string;
  /** When set, the confirm button stays disabled until this is typed exactly. */
  confirmPhrase?: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when reopened, so a previous attempt's text doesn't pre-arm it.
  useEffect(() => {
    if (visible) {
      setTyped('');
      setError(null);
      setWorking(false);
    }
  }, [visible]);

  const armed = !confirmPhrase || typed.trim() === confirmPhrase;

  async function handleConfirm() {
    setWorking(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.');
      setWorking(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>

          {consequences && consequences.length > 0 && (
            <View style={styles.consequences}>
              {consequences.map((line) => (
                <Text key={line} style={styles.consequence}>
                  · {line}
                </Text>
              ))}
            </View>
          )}

          {confirmPhrase && (
            <View style={styles.phraseBlock}>
              <Text style={styles.phraseLabel}>
                Type <Text style={styles.phrase}>{confirmPhrase}</Text> to confirm
              </Text>
              <TextInput
                style={styles.phraseInput}
                value={typed}
                onChangeText={setTyped}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder={confirmPhrase}
                placeholderTextColor={colors.disabled}
              />
            </View>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.actions}>
            {/* Cancel first and visually heavier: the safe path should be the
                easy one, and the destructive button should not be where a
                thumb already is. */}
            <Pressable
              style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
              onPress={onCancel}
              disabled={working}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.confirm,
                !armed && styles.confirmDisabled,
                pressed && styles.pressed,
              ]}
              onPress={handleConfirm}
              disabled={!armed || working}
            >
              {working ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={[styles.confirmText, !armed && styles.confirmTextDisabled]}>
                  {confirmLabel}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000000CC',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },

  title: { color: colors.text, fontSize: 19, fontWeight: '700' },
  body: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 8 },

  consequences: {
    marginTop: 14,
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 6,
    gap: 4,
  },
  consequence: { color: colors.accent, fontSize: 13, lineHeight: 18 },

  phraseBlock: { marginTop: 18 },
  phraseLabel: { color: colors.textMuted, fontSize: 13, marginBottom: 8 },
  phrase: { color: colors.text, fontFamily: mono, fontWeight: '700' },
  phraseInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    color: colors.text,
    fontSize: 15,
    fontFamily: mono,
    letterSpacing: 1,
    padding: 12,
  },

  error: { color: colors.accent, fontSize: 13, marginTop: 12, lineHeight: 18 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  pressed: { opacity: 0.8 },
  cancel: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  cancelText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  confirm: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  confirmDisabled: { backgroundColor: colors.disabled },
  confirmText: { color: colors.background, fontSize: 14, fontWeight: '700' },
  confirmTextDisabled: { color: colors.textFaint },
});
