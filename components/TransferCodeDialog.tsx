import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, type } from '../lib/theme';
import { focusRing, type PressState } from './ui';

/**
 * The code a seller gives the buyer, on paper like the other dialogs. The code
 * is the proof that the buyer was handed the car: with it they inherit the
 * log, without it they start a fresh one. It is shown here and not stored in
 * readable form anywhere, so the dialog says what to do if it is lost.
 */
export function TransferCodeDialog({
  visible,
  code,
  title,
  car,
  onClose,
}: {
  visible: boolean;
  code: string;
  title: string;
  /** "2004 Subaru WRX", for the message the seller shares. */
  car: string;
  onClose: () => void;
}) {
  async function share() {
    try {
      await Share.share({
        message: `Transfer code for the ${car} on Sonder: ${code}. Add the car by its VIN and enter this code to get its history. It works for 14 days.`,
      });
    } catch {
      // Not every browser can share; the code is selectable on screen.
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.body}>
            Give the buyer this code. When they add the {car} by its VIN and enter it, they inherit
            its log, and your entries stay credited to you. Without it they start a fresh log and
            see none of yours.
          </Text>

          <Text style={styles.code} selectable accessibilityLabel={`Transfer code ${code.split('').join(' ')}`}>
            {code}
          </Text>
          <Text style={styles.hint}>
            It works for 14 days. If you lose it, get a new one under Sold cars in your profile.
          </Text>

          <View style={styles.actions}>
            <Pressable
              style={(state) => [styles.share, (state as PressState).pressed && styles.pressed, (state as PressState).focused && focusRing]}
              accessibilityRole="button"
              onPress={share}
            >
              <Text style={styles.shareText}>Share code</Text>
            </Pressable>
            <Pressable
              style={(state) => [styles.done, (state as PressState).pressed && styles.pressed, (state as PressState).focused && focusRing]}
              accessibilityRole="button"
              onPress={onClose}
            >
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: 20 },
  dialog: {
    backgroundColor: colors.paper,
    borderRadius: radius.page,
    padding: 22,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  title: { ...type.title, color: colors.ink },
  body: { ...type.small, fontSize: type.compact.fontSize, lineHeight: 22, color: colors.inkMuted, marginTop: 8 },
  code: {
    fontFamily: fonts.monoBold,
    fontSize: 26,
    letterSpacing: 2,
    color: colors.ink,
    backgroundColor: colors.paperField,
    borderWidth: 1,
    borderColor: colors.paperLine,
    borderRadius: radius.input,
    paddingVertical: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  hint: { ...type.small, color: colors.inkMuted, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  pressed: { opacity: 0.8 },
  share: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.ink,
  },
  shareText: { fontFamily: fonts.bodySemi, fontSize: type.compact.fontSize, color: colors.ink },
  done: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    backgroundColor: colors.ink,
  },
  doneText: { fontFamily: fonts.bodySemi, fontSize: type.compact.fontSize, color: colors.paper },
});
