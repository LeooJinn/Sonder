import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { REPORT_REASONS, type ReportReason } from '../lib/moderation';
import { describeError } from '../lib/errors';
import { colors, fonts, radius, type } from '../lib/theme';
import { focusRing, type PressState } from './ui';

/**
 * Reporting a meet or a listing. Printed on paper, like the confirmation
 * dialogs, because it's a form someone is filing rather than a setting.
 */
export function ReportSheet({
  visible,
  what,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  /** "meet" or "listing", as the person would say it. */
  what: string;
  onSubmit: (reason: ReportReason, note: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setReason(null);
      setNote('');
      setSent(false);
      setError(null);
      setSending(false);
    }
  }, [visible]);

  async function send() {
    if (!reason) return;
    setSending(true);
    setError(null);
    try {
      await onSubmit(reason, note);
      setSent(true);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.sheet}>
            {sent ? (
              <>
                <Text style={styles.title} accessibilityRole="header">
                  Report sent
                </Text>
                <Text style={styles.body}>
                  Thanks. Every report is read, and when three members report the same {what}, it
                  comes down on its own until someone has looked at it.
                </Text>
                <Pressable
                  onPress={onClose}
                  accessibilityRole="button"
                  style={(state) => [styles.primary, (state as PressState).focused && focusRing]}
                >
                  <Text style={styles.primaryText}>Done</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.title} accessibilityRole="header">
                  Report this {what}
                </Text>
                <Text style={styles.body}>
                  Reports are private. Whoever posted it isn&apos;t told who reported it.
                </Text>

                <View style={styles.reasons} accessibilityRole="radiogroup">
                  {REPORT_REASONS.map((option) => {
                    const selected = reason === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => setReason(option.value)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        style={(state) => [
                          styles.reason,
                          selected && styles.reasonSelected,
                          (state as PressState).focused && focusRing,
                        ]}
                      >
                        <View style={[styles.radio, selected && styles.radioSelected]} />
                        <View style={styles.reasonText}>
                          <Text style={styles.reasonLabel}>{option.label}</Text>
                          <Text style={styles.reasonHint}>{option.hint}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Anything that would help (optional)"
                  placeholderTextColor={colors.inkMuted}
                  multiline
                  maxLength={500}
                  accessibilityLabel="Note"
                  style={styles.note}
                />

                {error && <Text style={styles.error}>{error}</Text>}

                <View style={styles.actions}>
                  <Pressable
                    onPress={onClose}
                    accessibilityRole="button"
                    style={(state) => [styles.secondary, (state as PressState).focused && focusRing]}
                  >
                    <Text style={styles.secondaryText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={send}
                    disabled={!reason || sending}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !reason || sending }}
                    style={(state) => [
                      styles.primary,
                      styles.flex,
                      !reason && styles.primaryDisabled,
                      (state as PressState).focused && focusRing,
                    ]}
                  >
                    {sending ? (
                      <ActivityIndicator color={colors.paper} />
                    ) : (
                      <Text style={[styles.primaryText, !reason && styles.primaryTextDisabled]}>
                        Send report
                      </Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0A1512D9' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  sheet: {
    backgroundColor: colors.paper,
    borderRadius: radius.page,
    padding: 22,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  title: { ...type.title, color: colors.ink },
  body: { ...type.small, fontSize: 15, lineHeight: 22, color: colors.inkMuted, marginTop: 8 },

  reasons: { gap: 8, marginTop: 18 },
  reason: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.paperLine,
  },
  reasonSelected: { borderColor: colors.ink, backgroundColor: '#F3F6F1' },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.inkMuted,
    marginTop: 2,
  },
  radioSelected: { borderColor: colors.ink, backgroundColor: colors.ink },
  reasonText: { flex: 1 },
  reasonLabel: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 20, color: colors.ink },
  reasonHint: { ...type.caption, color: colors.inkMuted, marginTop: 1 },

  note: {
    ...type.body,
    marginTop: 14,
    minHeight: 72,
    padding: 12,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.paperLine,
    backgroundColor: '#F3F6F1',
    color: colors.ink,
    textAlignVertical: 'top',
  },
  error: { ...type.small, color: '#A8322C', marginTop: 12 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  flex: { flex: 1 },
  primary: {
    minHeight: 50,
    borderRadius: radius.control,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 4,
  },
  primaryDisabled: { backgroundColor: colors.paperShade },
  primaryText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.paper },
  primaryTextDisabled: { color: colors.inkMuted },
  secondary: {
    minHeight: 50,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.paperLine,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 4,
  },
  secondaryText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
});
