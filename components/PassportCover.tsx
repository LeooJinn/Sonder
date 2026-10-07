import { StyleSheet, Text, View } from 'react-native';
import { LogoMark } from './LogoMark';
import { colors, fonts, type } from '../lib/theme';

/**
 * The passport cover that opens the signed-out screens: centred, foil, one
 * line saying what the document is. Shared by sign-in and password reset so
 * they read as one place.
 */
export function PassportCover() {
  return (
    <View style={styles.cover}>
      <LogoMark size={64} />
      <View style={styles.coverRule} />
      <Text style={styles.wordmark} accessibilityRole="header">
        Sonder
      </Text>
      <Text style={styles.docType}>Vehicle passport</Text>
      <View style={styles.coverRule} />
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { alignItems: 'center', gap: 14, marginBottom: 40 },
  coverRule: { width: 56, height: 1, backgroundColor: colors.border },
  wordmark: {
    fontFamily: fonts.displayBold,
    fontSize: 80,
    lineHeight: 78,
    color: colors.accent,
    letterSpacing: 1,
  },
  docType: { fontFamily: fonts.display, fontSize: type.item.fontSize, color: colors.accent, letterSpacing: 1 },
});
