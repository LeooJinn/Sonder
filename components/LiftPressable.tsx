import { useRef, type ComponentProps } from 'react';
import { Animated, Pressable } from 'react-native';
import { duration, ease, nativeDriver, useReducedMotion } from '../lib/motion';

/**
 * A pressable card that answers a pointer and a thumb. Under a mouse it rises
 * a few points, as a sheet of paper lifts when you slide a finger under its
 * edge; under a thumb it gives slightly, and comes back. Flat, no shadow: the
 * movement alone says it's alive.
 */
export function LiftPressable({
  lift = 4,
  onHoverIn,
  onHoverOut,
  onPressIn,
  onPressOut,
  ...props
}: ComponentProps<typeof Pressable> & { lift?: number }) {
  const reduced = useReducedMotion();
  const raise = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;

  const to = (value: Animated.Value, target: number, ms: number) => {
    if (reduced) {
      value.setValue(target);
      return;
    }
    Animated.timing(value, { toValue: target, duration: ms, easing: ease.out, useNativeDriver: nativeDriver }).start();
  };

  return (
    <Animated.View
      style={{
        transform: [
          { translateY: raise.interpolate({ inputRange: [0, 1], outputRange: [0, -lift] }) },
          { scale: press },
        ],
      }}
    >
      <Pressable
        {...props}
        onHoverIn={(e) => {
          to(raise, 1, duration.slow);
          onHoverIn?.(e);
        }}
        onHoverOut={(e) => {
          to(raise, 0, duration.slow);
          onHoverOut?.(e);
        }}
        onPressIn={(e) => {
          to(press, 0.985, 90);
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          to(press, 1, duration.base);
          onPressOut?.(e);
        }}
      />
    </Animated.View>
  );
}
