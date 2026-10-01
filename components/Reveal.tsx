import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { duration, ease, nativeDriver, useReducedMotion } from '../lib/motion';

/** The most items that get a staggered start; later ones arrive with the last of them. */
const STAGGER_CAP = 6;
const STAGGER_MS = 70;

/**
 * Things arrive the way papers are dealt onto a desk: a short rise and a
 * fade, one after another, each landing a little after the one before. Only
 * on the way in, only once, and the delay is capped so a long list never
 * makes anyone wait for its tail. Under reduced motion it just appears.
 */
export function Reveal({
  children,
  index = 0,
  delay = 0,
  rise = 16,
  style,
}: {
  children: ReactNode;
  /** Position in a list, for the stagger. */
  index?: number;
  delay?: number;
  rise?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: duration.slow + 120,
      delay: delay + Math.min(index, STAGGER_CAP) * STAGGER_MS,
      easing: ease.out,
      useNativeDriver: nativeDriver,
    });
    animation.start();
    return () => animation.stop();
    // Arrives once, when it first mounts.
  }, [reduced]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
