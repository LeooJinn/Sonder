import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../lib/theme';
import { useReducedMotion } from '../lib/motion';

/**
 * A tape odometer: the reading in large figures over a ruler that slides
 * past a fixed gold pointer, like a measuring tape drawn through a window.
 * Fed an Animated.Value from scroll, it does not follow every tick of the
 * wheel. It glides toward the target, easing out, so a jump of fifty thousand
 * miles is a smooth run rather than a flicker.
 */
const PX_PER_MILE = 1.6;
const MINOR = 10; // a tick every ten miles
const MAJOR = 100; // a labelled mark every hundred

export function OdometerTape({
  reading,
  tone,
  compact = false,
}: {
  reading: Animated.Value;
  tone: 'ground' | 'paper';
  compact?: boolean;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(() => (reading as unknown as { __getValue(): number }).__getValue());
  const target = useRef(shown);
  const current = useRef(shown);
  const raf = useRef(0);
  const last = useRef(0);
  const [width, setWidth] = useState(compact ? 300 : 470);

  useEffect(() => {
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last.current) / 1000 || 0.016);
      last.current = now;
      const gap = target.current - current.current;
      if (Math.abs(gap) < 0.05) {
        current.current = target.current;
        setShown(current.current);
        raf.current = 0;
        return;
      }
      // Frame-rate independent ease-out: closes about 85% of the gap every 200 ms.
      current.current += gap * (1 - Math.exp(-dt / 0.1));
      setShown(current.current);
      raf.current = requestAnimationFrame(tick);
    };
    const aim = (value: number) => {
      target.current = value;
      if (reduced) {
        current.current = value;
        setShown(value);
        return;
      }
      if (!raf.current) {
        last.current = performance.now();
        raf.current = requestAnimationFrame(tick);
      }
    };
    aim((reading as unknown as { __getValue(): number }).__getValue());
    const id = reading.addListener(({ value }) => aim(value));
    return () => {
      reading.removeListener(id);
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [reading, reduced]);

  const ground = tone === 'ground';
  const ink = ground ? colors.text : colors.ink;
  const faint = ground ? colors.textFaint : colors.inkMuted;
  const fade = ground ? colors.background : colors.paper;

  const half = width / 2;
  const span = half / PX_PER_MILE + MINOR;
  const first = Math.floor((shown - span) / MINOR) * MINOR;
  const ticks: number[] = [];
  for (let m = first; m <= shown + span; m += MINOR) if (m >= 0) ticks.push(m);

  const figure = Math.round(shown).toLocaleString('en-US');

  return (
    <View
      style={[styles.wrap, { width: compact ? '100%' : '100%' }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="text"
      accessibilityLabel="Odometer"
    >
      <View style={styles.figureRow}>
        <Text style={[styles.figure, compact && styles.figureCompact, { color: ink }]}>{figure}</Text>
        <Text style={[styles.unit, { color: faint }]}>mi</Text>
      </View>
      <View style={[styles.tape, compact && styles.tapeCompact]}>
        {ticks.map((m) => {
          const major = m % MAJOR === 0;
          const mid = m % 50 === 0;
          return (
            <View key={m} style={[styles.tickBox, { left: half + (m - shown) * PX_PER_MILE - 20 }]}>
              <View
                style={{
                  width: major ? 2 : 1,
                  height: major ? 22 : mid ? 15 : 9,
                  backgroundColor: major ? ink : faint,
                  opacity: major ? 0.9 : 0.7,
                }}
              />
              {major && !compact ? (
                <Text style={[styles.tickLabel, { color: faint }]}>{m.toLocaleString('en-US')}</Text>
              ) : null}
            </View>
          );
        })}
        <View pointerEvents="none" style={[styles.fade, styles.fadeLeft, { experimental_backgroundImage: `linear-gradient(90deg, ${fade}, rgba(0,0,0,0))` }]} />
        <View pointerEvents="none" style={[styles.fade, styles.fadeRight, { experimental_backgroundImage: `linear-gradient(270deg, ${fade}, rgba(0,0,0,0))` }]} />
        <View pointerEvents="none" style={[styles.pointer, { left: half - 1.5 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  figureRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  figure: { fontFamily: fonts.displayBold, fontSize: 64, lineHeight: 68, fontVariant: ['tabular-nums'] },
  figureCompact: { fontSize: 38, lineHeight: 42 },
  unit: { fontFamily: fonts.bodySemi, fontSize: 18 },
  tape: { height: 58, marginTop: 6, overflow: 'hidden' },
  tapeCompact: { height: 34, marginTop: 2 },
  tickBox: { position: 'absolute', top: 6, width: 40, alignItems: 'flex-start', paddingLeft: 19 },
  tickLabel: { fontFamily: fonts.bodyMedium, fontVariant: ['tabular-nums'], fontSize: 12, marginTop: 4, marginLeft: -14, width: 40 },
  fade: { position: 'absolute', top: 0, bottom: 0, width: 64 },
  fadeLeft: { left: 0 },
  fadeRight: { right: 0 },
  pointer: { position: 'absolute', top: 0, width: 3, height: 34, borderRadius: 2, backgroundColor: colors.accent },
});
