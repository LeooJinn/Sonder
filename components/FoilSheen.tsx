import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ease, nativeDriver, useReducedMotion } from '../lib/motion';

/**
 * The glint that crosses gold foil as you turn it in the light. Sits inside a
 * foil surface (which must clip its children) and sweeps across it once each
 * time `shine` changes: on hover, on press, and when a screen's one primary
 * action first arrives. Never loops. Nothing under reduced motion.
 */
export function FoilSheen({ shine, width }: { shine: number; width: number }) {
  const reduced = useReducedMotion();
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced || shine === 0 || width === 0) return;
    sweep.setValue(0);
    Animated.timing(sweep, { toValue: 1, duration: 820, easing: ease.inOut, useNativeDriver: nativeDriver }).start();
  }, [shine, reduced, width, sweep]);

  if (reduced || width === 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.band,
        {
          opacity: sweep.interpolate({ inputRange: [0, 0.08, 0.92, 1], outputRange: [0, 1, 1, 0] }),
          transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-70, width + 20] }) }],
        },
      ]}
    >
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="foil" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFF6D8" stopOpacity="0" />
            <Stop offset="0.5" stopColor="#FFF6D8" stopOpacity="0.62" />
            <Stop offset="1" stopColor="#FFF6D8" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#foil)" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  band: { position: 'absolute', top: -8, bottom: -8, left: 0, width: 56, transform: [{ skewX: '-18deg' }] },
});
