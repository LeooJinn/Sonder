import { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { easeOut, seg, useReducedMotion } from '../lib/motion';
import { rotateAbout } from '../lib/svgTransform';
import { colors } from '../lib/theme';

/** Five spokes from a small hub to the rim's inner edge, like a turbine wheel. */
function spokes(cx: number, cy: number): string {
  return [0, 1, 2, 3, 4]
    .map((k) => {
      const a = (-90 + k * 72) * (Math.PI / 180);
      const at = (r: number) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
      return `M${at(1)}L${at(2.05)}`;
    })
    .join('');
}

/**
 * The garage's empty bay: a car in side profile, drawn in one line the way an
 * engineer sketches it on a blueprint, then its wheels turn once as it comes
 * to rest. It is the same car as the Garage tab's icon, large. Under reduced
 * motion it is simply there.
 */
export function CarDrawing({ width = 300 }: { width?: number }) {
  const reduced = useReducedMotion();
  const clock = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const [t, setT] = useState(reduced ? 1 : 0);

  useEffect(() => {
    const id = clock.addListener(({ value }) => setT(value));
    return () => clock.removeListener(id);
  }, [clock]);

  useEffect(() => {
    if (reduced) {
      clock.setValue(1);
      return;
    }
    clock.setValue(0);
    const animation = Animated.timing(clock, { toValue: 1, duration: 1900, delay: 250, easing: (x) => x, useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [reduced, clock]);

  const draw = easeOut(seg(t, 0, 0.62));
  const roll = easeOut(seg(t, 0.35, 1));
  const spin = -720 * (1 - roll);
  const detail = easeOut(seg(t, 0.55, 0.85));
  const w = 0.22;
  const dash = (len: number, p: number) => (p < 1 ? { strokeDasharray: [len, len], strokeDashoffset: len * (1 - p) } : {});

  return (
    <View style={{ width, aspectRatio: 22 / 15 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="1 5.5 22 15">
        <G fill="none" stroke={colors.accent} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
          <Path
            d="M21.5 16v-2.5c0-.5-.3-.9-.8-1.1l-2.1-.8-2.9-3.3a1.5 1.5 0 0 0-1.1-.5h-3.2c-.5 0-.9.2-1.2.6l-2.2 3-3.5.9c-.9.2-1.6 1-1.6 1.9V16"
            {...dash(46, draw)}
          />
          <Path d="M2.5 16h1.9M9.6 16h4.8M19.6 16h1.9" {...dash(12, draw)} />
          <Path d="M8.7 11.9h9.9M12.3 8.4l-1 3.5" {...dash(14, draw)} />
          <Path d="M13.6 11.9v3" opacity={detail} stroke={colors.textMuted} />
          <Path d="M3.1 13.2h1.5M20.1 13.2h1" opacity={detail} stroke={colors.textMuted} />
          <Path d="M1 18.9h22" stroke={colors.border} opacity={draw} />
          {[7, 17].map((cx) => (
            <G key={cx} transform={rotateAbout(spin, cx, 16)}>
              <Path d={`M${cx - 2.6} 16a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0`} {...dash(17, draw)} />
              <Path d={`M${cx - 1} 16a1 1 0 1 0 2 0a1 1 0 1 0 -2 0`} opacity={detail} />
              <Path d={spokes(cx, 16)} opacity={detail} />
            </G>
          ))}
        </G>
      </Svg>
    </View>
  );
}
