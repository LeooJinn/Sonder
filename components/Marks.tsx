import { StyleSheet, View } from 'react-native';

/**
 * The two marks the app needs, drawn rather than typed. A "×" or "✓"
 * character renders in whatever the font makes of it, at a weight and
 * baseline that never quite match the surrounding type.
 */

/** A close mark: two strokes crossing. */
export function CloseMark({ size = 12, color, weight = 2 }: { size?: number; color: string; weight?: number }) {
  const bar = { width: size, height: weight, borderRadius: weight / 2, backgroundColor: color };
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[styles.absolute, bar, { transform: [{ rotate: '45deg' }] }]} />
      <View style={[styles.absolute, bar, { transform: [{ rotate: '-45deg' }] }]} />
    </View>
  );
}

/** A tick: the short and long sides of an L, turned. */
export function CheckMark({ size = 12, color, weight = 2 }: { size?: number; color: string; weight?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size * 0.42,
          height: size * 0.78,
          marginTop: -size * 0.14,
          borderRightWidth: weight,
          borderBottomWidth: weight,
          borderColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  absolute: { position: 'absolute' },
});
