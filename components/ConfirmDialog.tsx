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
import { colors, fonts, radius, type } from '../lib/theme';
import { focusRing, noOutline, type PressState } from './ui';

/** Red that reads as red on paper; the cover's red is tuned for dark ground. */
const STAMP_RED = '#A8322C';

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
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.body}>{body}</Text>

          {consequences && consequences.length > 0 && (
            <View style={styles.consequences}>
              {consequences.map((line) => (
                <Text key={line} style={styles.consequence}>
                  {line}
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
                style={[styles.phraseInput, noOutline, typed && styles.phraseInputActive]}
                value={typed}
                onChangeText={setTyped}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder={confirmPhrase}
                placeholderTextColor={colors.paperLine}
                accessibilityLabel={`Type ${confirmPhrase} to confirm`}
              />
            </View>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.actions}>
            {/* Cancel first and visually heavier: the safe path should be the
                easy one, and the destructive button should not be where a
                thumb already is. */}
            <Pressable
              style={(state) => {
                const { pressed, focused } = state as PressState;
                return [styles.cancel, pressed && styles.pressed, focused && focusRing];
              }}
              accessibilityRole="button"
              onPress={onCancel}
              disabled={working}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={(state) => {
                const { pressed, focused } = state as PressState;
                return [
                  styles.confirm,
                  !armed && styles.confirmDisabled,
                  pressed && styles.pressed,
                  focused && focusRing,
                ];
              }}
              accessibilityRole="button"
              accessibilityState={{ disabled: !armed || working }}
              onPress={handleConfirm}
              disabled={!armed || working}
            >
              {working ? (
                <ActivityIndicator color={STAMP_RED} />
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
    backgroundColor: '#0A1512D9',
    justifyContent: 'center',
    padding: 20,
  },
  dialog: {
    backgroundColor: colors.paper,
    borderRadius: radius.page,
    padding: 22,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },

  title: { ...type.title, color: colors.ink },
  body: { ...type.small, fontSize: 15, lineHeight: 22, color: colors.inkMuted, marginTop: 8 },

  consequences: {
    marginTop: 16,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: STAMP_RED,
    gap: 4,
  },
  consequence: { ...type.small, fontFamily: fonts.bodyMedium, color: STAMP_RED },

  phraseBlock: { marginTop: 20 },
  phraseLabel: { ...type.small, color: colors.inkMuted, marginBottom: 8 },
  phrase: { fontFamily: fonts.monoBold, color: colors.ink },
  phraseInput: {
    backgroundColor: '#F3F6F1',
    borderWidth: 1,
    borderColor: colors.paperLine,
    borderRadius: radius.input,
    color: colors.ink,
    fontSize: 15,
    fontFamily: fonts.mono,
    letterSpacing: 1,
    padding: 12,
  },

  phraseInputActive: { borderColor: colors.ink },

  error: { ...type.small, color: STAMP_RED, marginTop: 12 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  pressed: { opacity: 0.8 },
  cancel: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    backgroundColor: colors.ink,
  },
  cancelText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.paper },
  confirm: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: STAMP_RED,
  },
  confirmDisabled: { borderColor: colors.paperLine },
  confirmText: { fontFamily: fonts.bodySemi, fontSize: 15, color: STAMP_RED },
  confirmTextDisabled: { color: colors.inkMuted },
});
