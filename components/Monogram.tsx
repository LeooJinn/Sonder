import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../lib/theme';

/** Up to two initials from a name or a handle: "Sam Ortiz" is SO, "@jordan" is J. */
export function initials(name: string): string {
  const words = name.replace(/^@/, '').split(/[\s._-]+/).filter(Boolean);
  if (words.length === 0) return '?';
  const letters = words.length === 1 ? words[0].slice(0, 1) : words[0][0] + words[words.length - 1][0];
  return letters.toUpperCase();
}

/**
 * A person's seal: their initials on a small round of paper, the way a
 * notary's stamp or a passport photo's embossed corner marks whose it is.
 * Everything about a person on Sonder is drawn from words, so there is no
 * photo to fall back on.
 */
export function Monogram({ name, size = 46 }: { name: string; size?: number }) {
  return (
    <View
      style={[styles.seal, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.ring, { borderRadius: size / 2 - 3 }]}>
        <Text style={[styles.letters, { fontSize: size * 0.4, lineHeight: size * 0.46 }]}>{initials(name)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  seal: { backgroundColor: colors.paper, padding: 3 },
  ring: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.paperLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letters: { fontFamily: fonts.displayBold, color: colors.ink, letterSpacing: 0.5 },
});
