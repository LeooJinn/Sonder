import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../lib/theme';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

/**
 * Where each drum sits for a reading, the way a mechanical odometer works:
 * the ones drum turns continuously, and every other drum only turns while
 * the drum to its right rolls from 9 over to 0. A reading of 58,209.5 shows
 * the tens drum half way between 0 and 1, and nothing further left moving.
 */
export function drumPositions(reading: number, drums: number): number[] {
  const value = Math.max(0, reading);
  return Array.from({ length: drums }, (_, k) => {
    const place = 10 ** k;
    const whole = Math.floor(value / place) % 10;
    if (k === 0) return (value % 10 + 10) % 10;
    // How far the drums to the right are into their final unit before a carry.
    const below = value % place;
    const carry = below > place - 1 ? below - (place - 1) : 0;
    return whole + carry;
  });
}

/**
 * An odometer: a row of drums, each a column of digits that scrolls behind a
 * window. Pass a number, or an Animated.Value to drive it frame by frame
 * without re-rendering (scroll-linked readings).
 */
export function Odometer({
  reading,
  drums = 6,
  size = 56,
}: {
  reading: number | Animated.Value;
  drums?: number;
  size?: number;
}) {
  const cell = Math.round(size * 1.25);
  // One Animated.Value per drum, ones first.
  const positions = useMemo(
    () => Array.from({ length: drums }, () => new Animated.Value(0)),
    [drums]
  );
  const last = useRef<number | null>(null);

  useEffect(() => {
    const apply = (value: number) => {
      if (last.current === value) return;
      last.current = value;
      drumPositions(value, drums).forEach((p, k) => positions[k].setValue(p));
    };

    if (typeof reading === 'number') {
      apply(reading);
      return;
    }
    apply((reading as unknown as { __getValue(): number }).__getValue());
    const id = reading.addListener(({ value }) => apply(value));
    return () => reading.removeListener(id);
  }, [reading, drums, positions]);

  // Drums are laid out most significant first; positions[] is ones first.
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="text"
      accessibilityLabel="Odometer"
    >
      {Array.from({ length: drums }, (_, i) => {
        const k = drums - 1 - i;
        const isLast = k === 0;
        return (
          <View
            key={k}
            style={[
              styles.window,
              { width: Math.round(size * 0.78), height: cell },
              isLast && styles.windowLast,
            ]}
          >
            <Animated.View
              style={{
                transform: [
                  {
                    translateY: positions[k].interpolate({
                      inputRange: [0, 10],
                      outputRange: [0, -10 * cell],
                    }),
                  },
                ],
              }}
            >
              {DIGITS.map((digit, d) => (
                <Text
                  key={d}
                  style={[
                    styles.digit,
                    { fontSize: size, lineHeight: cell, height: cell },
                    isLast && styles.digitLast,
                  ]}
                >
                  {digit}
                </Text>
              ))}
            </Animated.View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  // Depth comes from the window itself: digits are cut off at its edges as
  // they roll through, the way a real drum's numerals disappear round it.
  window: {
    overflow: 'hidden',
    backgroundColor: colors.ink,
    borderRadius: 4,
    alignItems: 'center',
  },
  windowLast: { backgroundColor: colors.accent },
  digit: {
    fontFamily: fonts.mono,
    color: colors.paper,
    textAlign: 'center',
  },
  digitLast: { color: colors.ink },
});
