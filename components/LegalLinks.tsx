import { StyleSheet, Text } from 'react-native';
import { Link } from 'expo-router';
import { colors, fonts, type } from '../lib/theme';

/** "Privacy Policy · Terms of Use", small, for the foot of a screen. */
export function LegalLinks({ align = 'center' }: { align?: 'center' | 'left' }) {
  return (
    <Text style={[styles.row, { textAlign: align }]}>
      <Link href="/privacy" style={styles.link}>
        Privacy Policy
      </Link>
      {'  ·  '}
      <Link href="/terms" style={styles.link}>
        Terms of Use
      </Link>
    </Text>
  );
}

const styles = StyleSheet.create({
  row: { ...type.small, color: colors.textFaint },
  link: { fontFamily: fonts.bodyMedium, color: colors.textMuted, textDecorationLine: 'underline' },
});
