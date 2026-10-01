import { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { duration, easeOut, seg, useReducedMotion } from '../lib/motion';
import { rotateAbout, scaleAbout, translate } from '../lib/svgTransform';

export type IconName = 'garage' | 'following' | 'market' | 'meets' | 'messages';

const STROKE = 1.75;

/**
 * Pictograms drawn the way instrument-cluster symbols are: one stroke weight,
 * round ends, a 24-unit grid, nothing a font could supply. Each has a single
 * small motion, played when its tab becomes the current one, that says what
 * the thing is: a car rolls in, a signal pulses out, a price tag swings, a pin
 * drops, a reply types. At rest they are plain outlines.
 */

/** A path that can be drawn on: dashed so only `draw` (0..1) of it shows. */
function Stroke({ d, length, draw, color }: { d: string; length: number; draw: number; color: string }) {
  const drawing = draw < 1;
  return (
    <Path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(drawing ? { strokeDasharray: [length, length], strokeDashoffset: length * (1 - draw) } : {})}
    />
  );
}

/** One damped swing: starts at `amplitude`, rings, comes to rest at 0. */
function swing(t: number, amplitude: number): number {
  return amplitude * Math.exp(-5 * t) * Math.cos(t * 17);
}

function Garage({ t, color, accent }: { t: number; color: string; accent: string }) {
  const draw = easeOut(seg(t, 0, 0.5));
  const roll = easeOut(seg(t, 0, 0.8));
  const x = -4 * (1 - roll);
  const spin = -540 * (1 - roll);
  return (
    <G transform={translate(x, 0)}>
      <Stroke
        d="M21.5 16v-2.5c0-.5-.3-.9-.8-1.1l-2.1-.8-2.9-3.3a1.5 1.5 0 0 0-1.1-.5h-3.2c-.5 0-.9.2-1.2.6l-2.2 3-3.5.9c-.9.2-1.6 1-1.6 1.9V16"
        length={44}
        draw={draw}
        color={color}
      />
      <Stroke d="M2.5 16h1.9M9.6 16h4.8M19.6 16h1.9" length={12} draw={draw} color={color} />
      <Stroke d="M8.7 11.9h9.9M12.3 8.4l-1 3.5" length={14} draw={draw} color={color} />
      {[7, 17].map((cx) => (
        <G key={cx} transform={rotateAbout(spin, cx, 16)}>
          <Stroke d={`M${cx - 2.6} 16a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0`} length={17} draw={draw} color={color} />
          <Path d={`M${cx} 16v-1.5`} stroke={accent} strokeWidth={STROKE} strokeLinecap="round" opacity={seg(t, 0.15, 0.4)} />
        </G>
      ))}
    </G>
  );
}

function Following({ t, color, accent }: { t: number; color: string; accent: string }) {
  const dot = easeOut(seg(t, 0, 0.25));
  const inner = easeOut(seg(t, 0.12, 0.5));
  const outer = easeOut(seg(t, 0.32, 0.78));
  const grow = (v: number) => 0.55 + 0.45 * v;
  return (
    <G>
      <Circle cx={12} cy={12} r={1.7 * (0.5 + 0.5 * dot)} fill={accent} />
      <G opacity={inner} transform={scaleAbout(grow(inner), 12, 12)}>
        <Path d="M8.07 9.25A4.8 4.8 0 0 0 8.07 14.75M15.93 9.25A4.8 4.8 0 0 1 15.93 14.75" fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      </G>
      <G opacity={outer} transform={scaleAbout(grow(outer), 12, 12)}>
        <Path d="M4.96 7.07A8.6 8.6 0 0 0 4.96 16.93M19.04 7.07A8.6 8.6 0 0 1 19.04 16.93" fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      </G>
    </G>
  );
}

function Market({ t, color, accent }: { t: number; color: string; accent: string }) {
  const draw = easeOut(seg(t, 0, 0.45));
  const angle = swing(seg(t, 0.1, 1), -22);
  return (
    <G transform={rotateAbout(angle, 8.5, 8.5)}>
      <Stroke
        d="M4 4.7A.7.7 0 0 1 4.7 4h6.5a.7.7 0 0 1 .5.2l8.1 8.1a.7.7 0 0 1 0 1l-6.4 6.4a.7.7 0 0 1-1 0L4.2 11.6a.7.7 0 0 1-.2-.5z"
        length={54}
        draw={draw}
        color={color}
      />
      <Circle cx={8.5} cy={8.5} r={1.3} fill="none" stroke={accent} strokeWidth={STROKE} />
    </G>
  );
}

function Meets({ t, color, accent }: { t: number; color: string; accent: string }) {
  const fall = seg(t, 0, 0.5);
  // Drops in, touches down, and settles with one small rebound.
  const y = fall < 1 ? -9 * (1 - fall * fall) : -1.6 * Math.exp(-9 * seg(t, 0.5, 1)) * Math.abs(Math.sin(seg(t, 0.5, 1) * 9));
  const ripple = seg(t, 0.45, 1);
  return (
    <G>
      <Ellipse cx={12} cy={21.6} rx={2 + 6 * ripple} ry={0.4 + 1.1 * ripple} fill="none" stroke={accent} strokeWidth={1.4} opacity={ripple > 0 ? (1 - ripple) * 0.9 : 0} />
      <G transform={translate(0, y)}>
        <Path d="M12 21C12 21 5 15.2 5 9.8a7 7 0 0 1 14 0C19 15.2 12 21 12 21z" fill="none" stroke={color} strokeWidth={STROKE} strokeLinejoin="round" />
        <Circle cx={12} cy={9.8} r={2.5} fill="none" stroke={accent} strokeWidth={STROKE} />
      </G>
      <Path d="M8.6 22h6.8" stroke={color} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
    </G>
  );
}

function Messages({ t, color, accent }: { t: number; color: string; accent: string }) {
  const draw = easeOut(seg(t, 0, 0.5));
  return (
    <G>
      <Stroke
        d="M5.2 4.5h13.6a1.7 1.7 0 0 1 1.7 1.7v8.1a1.7 1.7 0 0 1-1.7 1.7H11l-4.3 3.4a.5.5 0 0 1-.8-.4V16H5.2a1.7 1.7 0 0 1-1.7-1.7V6.2a1.7 1.7 0 0 1 1.7-1.7z"
        length={60}
        draw={draw}
        color={color}
      />
      {[8.4, 12, 15.6].map((cx, i) => {
        const on = easeOut(seg(t, 0.4 + i * 0.14, 0.58 + i * 0.14));
        return <Circle key={cx} cx={cx} cy={10.3 - 1.6 * (1 - on)} r={0.95 * (0.3 + 0.7 * on)} fill={accent} opacity={on} />;
      })}
    </G>
  );
}

const ICONS = { garage: Garage, following: Following, market: Market, meets: Meets, messages: Messages };

/**
 * A tab's icon. `active` turns it foil and, on the moment it becomes true,
 * plays its motion once. Under reduced motion it simply changes colour.
 */
export function TabIcon({
  name,
  active,
  color,
  accent,
  size = 26,
}: {
  name: IconName;
  active: boolean;
  color: string;
  /** The detail colour: hubs, the tag's hole, the signal's dot. */
  accent: string;
  size?: number;
}) {
  const reduced = useReducedMotion();
  const clock = useRef(new Animated.Value(1)).current;
  const [t, setT] = useState(1);
  const was = useRef(active);

  useEffect(() => {
    const id = clock.addListener(({ value }) => setT(value));
    return () => clock.removeListener(id);
  }, [clock]);

  useEffect(() => {
    if (active && !was.current && !reduced) {
      clock.setValue(0);
      Animated.timing(clock, { toValue: 1, duration: duration.focal + 120, easing: (x) => x, useNativeDriver: false }).start();
    }
    was.current = active;
  }, [active, reduced, clock]);

  const Icon = ICONS[name];
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Icon t={t} color={color} accent={accent} />
      </Svg>
    </View>
  );
}

