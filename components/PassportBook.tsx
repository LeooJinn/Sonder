import { StyleSheet, Text, View } from 'react-native';
import type { Animated } from 'react-native';
import { colors, fonts, object, radius } from '../lib/theme';
import { LogoMark } from './LogoMark';

/**
 * The passport as an object, for phones. The web build draws it in 3D
 * (PassportBook.web.tsx: it opens as you scroll); on a device it is the flat
 * cover, the same green, foil and rosette, standing still. `story` and
 * `restAt` are accepted so both builds take the same props.
 */
export function PassportBook(_props: { story?: Animated.Value; restAt?: number }) {
  return (
    <View style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.cover}>
        <Text style={styles.wordmark}>Sonder</Text>
        <Text style={styles.docType}>Vehicle passport</Text>
        <View style={styles.mark}>
          <LogoMark size={96} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  cover: {
    height: '88%',
    aspectRatio: 300 / 424,
    maxWidth: '92%',
    borderRadius: radius.page,
    backgroundColor: object.coverMid,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    paddingTop: 30,
  },
  wordmark: { fontFamily: fonts.displayBold, fontSize: 38, color: colors.accent, letterSpacing: 1.5 },
  docType: { fontFamily: fonts.display, fontSize: 14, color: colors.accent, letterSpacing: 4, marginTop: 6 },
  mark: { flex: 1, justifyContent: 'center' },
});
