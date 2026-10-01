import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { duration, ease, nativeDriver, useReducedMotion } from '../lib/motion';
import { colors, radius } from '../lib/theme';

/**
 * A page-shaped placeholder for something loading, with a light passing
 * across it. It shows the shape of what's coming (a photo, a name, a line of
 * small type) so the layout doesn't jump when the real thing arrives.
 */
export function SkeletonBlock({ style }: { style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 1500, easing: ease.inOut, useNativeDriver: nativeDriver })
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, sweep]);

  return (
    <View style={[styles.block, style]}>
      {reduced ? null : (
        <Animated.View
          pointerEvents="none"
          style={[styles.light, { transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-160, 520] }) }] }]}
        >
          <Svg width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="s" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.border} stopOpacity="0" />
                <Stop offset="0.5" stopColor={colors.border} stopOpacity="0.55" />
                <Stop offset="1" stopColor={colors.border} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#s)" />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

/** The shape of a garage or feed card: a photo, a name, two small lines. */
export function SkeletonCard() {
  return (
    <View style={styles.card} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <SkeletonBlock style={styles.photo} />
      <View style={styles.body}>
        <SkeletonBlock style={[styles.line, { width: '38%' }]} />
        <SkeletonBlock style={[styles.line, { width: '62%', height: 28, marginTop: 10 }]} />
        <SkeletonBlock style={[styles.line, { width: '48%', marginTop: 14 }]} />
      </View>
    </View>
  );
}

/** The shape of a logbook line: a tile on the left, a small line, a title, a sentence. */
export function SkeletonRow() {
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <SkeletonBlock style={styles.tile} />
      <View style={styles.rowText}>
        <SkeletonBlock style={[styles.line, { width: '40%' }]} />
        <SkeletonBlock style={[styles.line, { width: '86%', height: 20, marginTop: 10 }]} />
        <SkeletonBlock style={[styles.line, { width: '64%', marginTop: 10 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 16, paddingVertical: 12 },
  tile: { width: 64, height: 64, borderRadius: radius.control },
  rowText: { flex: 1, paddingTop: 2 },
  block: { backgroundColor: colors.surface, overflow: 'hidden', borderRadius: radius.photo },
  light: { position: 'absolute', top: 0, bottom: 0, width: 160 },
  card: { backgroundColor: colors.surface, borderRadius: radius.page, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 16 / 10, borderRadius: 0, backgroundColor: colors.surface },
  body: { padding: 18, paddingBottom: 20 },
  line: { height: 14 },
});
