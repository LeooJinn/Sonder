import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { duration, ease, nativeDriver, seg, useReducedMotion } from '../lib/motion';
import { colors, fonts, radius } from '../lib/theme';

/**
 * A rubber stamp coming down on a page: the one gesture a passport has for
 * "this happened, officially". It lands hard (a quick scale down, a ring of
 * impact) and then stays. Kept for the moments that are milestones: a car
 * entered on the books, a passport issued. Under reduced motion it simply
 * appears in place.
 */
export function Stamp({
  label,
  note,
  color = colors.stampInk,
  tilt = -6,
  play = true,
  instant,
  compact,
  onLanded,
}: {
  label: string;
  /** The small line under the label, in the machine face: a date, a place. */
  note?: string;
  color?: string;
  tilt?: number;
  /** Set true to bring it down; false keeps it off the page. */
  play?: boolean;
  /** Show it already in place, with no coming down: for a stamp that is just there. */
  instant?: boolean;
  compact?: boolean;
  onLanded?: () => void;
}) {
  const reduced = useReducedMotion();
  const clock = useRef(new Animated.Value(0)).current;
  const [t, setT] = useState(0);

  useEffect(() => {
    const id = clock.addListener(({ value }) => setT(value));
    return () => clock.removeListener(id);
  }, [clock]);

  useEffect(() => {
    if (!play) {
      clock.setValue(0);
      return;
    }
    if (reduced || instant) {
      clock.setValue(1);
      onLanded?.();
      return;
    }
    clock.setValue(0);
    const animation = Animated.timing(clock, {
      toValue: 1,
      duration: duration.focal,
      easing: (x) => x,
      useNativeDriver: false,
    });
    animation.start(({ finished }) => finished && onLanded?.());
    return () => animation.stop();
  }, [play, reduced, instant]);

  if (!play && t === 0) return null;

  // The stamp drops from above the page: big and faint, then down to size.
  const drop = seg(t, 0, 0.26);
  const landed = ease.out(seg(t, 0.26, 1));
  const scale = drop < 1 ? 1.9 - 0.9 * drop * drop : 1 - 0.035 * (1 - landed);
  const opacity = reduced ? 1 : Math.min(1, seg(t, 0, 0.14) * 1.4);
  const angle = tilt - 9 * (1 - drop);
  const ring = seg(t, 0.26, 0.85);

  return (
    <View pointerEvents="none" style={styles.wrap}>
      {ring > 0 && ring < 1 ? (
        <View
          style={[
            styles.ring,
            { borderColor: color, opacity: 0.55 * (1 - ring), transform: [{ rotate: `${tilt}deg` }, { scale: 1 + 0.32 * ring }] },
          ]}
        />
      ) : null}
      <View
        style={[
          styles.outer,
          { borderColor: color, opacity: opacity * 0.94, transform: [{ rotate: `${angle}deg` }, { scale }] },
        ]}
      >
        <View style={[styles.inner, { borderColor: color }]}>
          <Text style={[styles.label, compact && styles.labelCompact, { color }]}>{label}</Text>
          {note ? <Text style={[styles.note, compact && styles.noteCompact, { color }]}>{note}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  outer: { borderWidth: 3, borderRadius: radius.photo, padding: 3 },
  inner: { borderWidth: 1, borderRadius: radius.tag, paddingHorizontal: 14, paddingVertical: 6, alignItems: 'center' },
  ring: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderWidth: 2, borderRadius: radius.photo },
  label: { fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 32, letterSpacing: 3 },
  labelCompact: { fontSize: 22, lineHeight: 24, letterSpacing: 2.5 },
  note: { fontFamily: fonts.mono, fontSize: 10, lineHeight: 14, letterSpacing: 1.5, marginTop: 1 },
  noteCompact: { fontSize: 9, lineHeight: 12 },
});
