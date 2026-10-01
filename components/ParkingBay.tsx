import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { duration, ease, nativeDriver, useReducedMotion } from '../lib/motion';
import { colors, fonts, radius, type } from '../lib/theme';
import { focusRing, type PressState } from './ui';

/**
 * An empty bay at the end of the garage, marked out in dashed paint the way a
 * parking space is, with room for one more. It is the "add a car" action, and
 * it reads as a place rather than a button: you are about to park something.
 * The plus turns a quarter on hover or focus, as a latch would.
 */
export function ParkingBay({ number, onPress }: { number: number; onPress: () => void }) {
  const reduced = useReducedMotion();
  const turn = useRef(new Animated.Value(0)).current;
  const to = (value: number) => {
    if (reduced) {
      turn.setValue(value);
      return;
    }
    Animated.timing(turn, { toValue: value, duration: duration.slow, easing: ease.out, useNativeDriver: nativeDriver }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => to(1)}
      onHoverOut={() => to(0)}
      onFocus={() => to(1)}
      onBlur={() => to(0)}
      accessibilityRole="button"
      accessibilityLabel="Add a car"
      accessibilityHint="Opens the VIN lookup to add another car to your garage"
      style={(state) => {
        const { pressed, focused, hovered } = state as PressState;
        return [styles.bay, (hovered || focused) && styles.bayActive, pressed && styles.pressed, focused && focusRing];
      }}
    >
      <Animated.View
        style={[
          styles.plus,
          { transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) }] },
        ]}
      >
        <View style={[styles.stroke, styles.horizontal]} />
        <View style={[styles.stroke, styles.vertical]} />
      </Animated.View>
      <View style={styles.text}>
        <Text style={styles.number}>Bay {number}</Text>
        <Text style={styles.title}>Add a car</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    minHeight: 112,
    paddingHorizontal: 22,
    borderRadius: radius.page,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  bayActive: { borderColor: colors.accent },
  pressed: { opacity: 0.75 },
  plus: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  stroke: { position: 'absolute', backgroundColor: colors.accent, borderRadius: 1 },
  horizontal: { width: 28, height: 2 },
  vertical: { width: 2, height: 28 },
  text: { flex: 1 },
  number: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 16, letterSpacing: 1.5, color: colors.textFaint },
  title: { ...type.title, color: colors.text, marginTop: 1 },
});
