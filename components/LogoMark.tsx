import { StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, G } from 'react-native-svg';
import { rotateAbout } from '../lib/svgTransform';
import { colors, fonts, radius } from '../lib/theme';

const VIEW = 420;
const C = VIEW / 2;

/**
 * The Sonder mark: a foil S on the passport cover, inside the cover's own
 * engraved rosette. It is the app icon at small size, so it sits beside the
 * wordmark (the front page, the sign-in cover) and nowhere else: foil means
 * the wordmark, and the mark is part of it.
 *
 * Decorative: the word "Sonder" always sits next to it, so it is hidden
 * from screen readers.
 */
export function LogoMark({ size = 32 }: { size?: number }) {
  // Fewer turns at small sizes, so the rosette stays a texture and not a smudge.
  const turns = size >= 56 ? 36 : size >= 40 ? 24 : 16;
  // Keep the line about a pixel wide whatever the size.
  const line = VIEW / size;

  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: size >= 56 ? radius.page : radius.control },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`} style={StyleSheet.absoluteFill}>
        <G fill="none" stroke={colors.border} strokeWidth={line * 0.9}>
          {Array.from({ length: turns }, (_, k) => (
            <Ellipse
              key={k}
              cx={C}
              cy={C}
              rx={C - 6}
              ry={(C - 6) * 0.34}
              transform={rotateAbout((k * 180) / turns, C, C)}
            />
          ))}
        </G>
      </Svg>
      <Text style={[styles.letter, { fontSize: size * 0.74, lineHeight: size * 0.8 }]}>S</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  letter: { fontFamily: fonts.displayBold, color: colors.accent, textAlign: 'center', includeFontPadding: false },
});
