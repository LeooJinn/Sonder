import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { KIND_LABELS, type EntryKind } from '../lib/log';
import { duration, ease, nativeDriver, useReducedMotion } from '../lib/motion';
import { colors, fonts, KIND_COLORS, KIND_COLORS_ON_PAPER, radius } from '../lib/theme';
import { Guilloche } from './Guilloche';
import { Stamp } from './Stamp';

/**
 * The pages inside the front page's passport (see PassportBook). Each is a
 * printed sheet, 300 by 424 units, built from the same pieces as the real
 * app: security paper, ink, the guilloché, kind inks and the rubber stamp.
 * Everything here is an illustration of a car's life and says so.
 */
export const PAGE_W = 300;
export const PAGE_H = 424;

/** The example car's VIN: seventeen characters, no I, O or Q, and obviously not real. */
const EXAMPLE_VIN = 'SDEXAMPLE00000001';

/** What the pages show at each point of the story: how many entries are written so far. */
export type BookStage = 0 | 1 | 2 | 3 | 4;

function Sheet({ children, shade }: { children: React.ReactNode; shade?: boolean }) {
  return (
    <View style={[styles.sheet, shade && styles.sheetShade]}>
      <Guilloche />
      {children}
    </View>
  );
}

/** An entry arrives the way a line is written: a short rise and a fade, once. */
function Written({ show, children }: { show: boolean; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(show ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      t.setValue(show ? 1 : 0);
      return;
    }
    Animated.timing(t, {
      toValue: show ? 1 : 0,
      duration: show ? duration.slow : duration.base,
      easing: ease.out,
      useNativeDriver: nativeDriver,
    }).start();
  }, [show, reduced]);
  return (
    <Animated.View
      style={{ opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}
    >
      {children}
    </Animated.View>
  );
}

function EntryRow({
  kind,
  title,
  miles,
  show,
}: {
  kind: EntryKind;
  title: string;
  miles: number;
  show: boolean;
}) {
  return (
    <Written show={show}>
      <View style={styles.entry}>
        <View style={[styles.dot, { borderColor: KIND_COLORS[kind] }]} />
        <View style={styles.entryBody}>
          <Text style={styles.entryTitle}>{title}</Text>
          <Text style={styles.entryMeta}>
            <Text style={[styles.entryKind, { color: KIND_COLORS_ON_PAPER[kind] }]}>{KIND_LABELS[kind]}</Text>
            {' at '}
            <Text style={styles.entryMiles}>{miles.toLocaleString('en-US')} mi</Text>
          </Text>
        </View>
      </View>
    </Written>
  );
}

/** A car in side profile, drawn in one ink line, for the data page's photo. */
function CarLine({ width }: { width: number }) {
  return (
    <Svg width={width} height={(width * 15) / 22} viewBox="1 5.5 22 15">
      <G fill="none" stroke={colors.ink} strokeWidth={0.22} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M21.5 16v-2.5c0-.5-.3-.9-.8-1.1l-2.1-.8-2.9-3.3a1.5 1.5 0 0 0-1.1-.5h-3.2c-.5 0-.9.2-1.2.6l-2.2 3-3.5.9c-.9.2-1.6 1-1.6 1.9V16" />
        <Path d="M2.5 16h1.9M9.6 16h4.8M19.6 16h1.9M8.7 11.9h9.9M12.3 8.4l-1 3.5" />
        <Path d="M13.6 11.9v3M3.1 13.2h1.5M20.1 13.2h1" stroke={colors.inkMuted} />
        <Path d="M1 18.9h22" stroke={colors.paperLine} />
        {[7, 17].map((cx) => (
          <G key={cx}>
            <Path d={`M${cx - 2.6} 16a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0`} />
            <Path d={`M${cx - 1} 16a1 1 0 1 0 2 0a1 1 0 1 0 -2 0`} />
          </G>
        ))}
      </G>
    </Svg>
  );
}

/** The inside of the front cover: endpaper. */
export function EndpaperPage() {
  return (
    <Sheet shade>
      <View style={styles.endpaper}>
        <View style={styles.rule} />
        <Text style={styles.endTitle}>This passport belongs to the car.</Text>
        <Text style={styles.endBody}>
          Whoever holds the keys, the history stays here, in the order it happened.
        </Text>
        <View style={styles.rule} />
        <Text style={styles.endIssued}>Issued by Sonder</Text>
      </View>
    </Sheet>
  );
}

/** Page one: the car's identity page. */
export function DataPrintPage() {
  const strip = ['V<SDRMAZDA<<MX5<MIATA<<<<<<<<<<<<<', `${EXAMPLE_VIN}<1999<<<<<<<<<<<<<<`].map((l) =>
    l.padEnd(36, '<').slice(0, 36)
  );
  return (
    <Sheet>
      <View style={styles.dataHead}>
        <Text style={styles.docMono}>Vehicle passport</Text>
        <Text style={styles.docMono}>Example car</Text>
      </View>
      <View style={styles.photo}>
        <CarLine width={188} />
      </View>
      <View style={styles.dataBody}>
        <Text style={styles.make}>1999 · Mazda</Text>
        <Text style={styles.model}>MX-5 Miata</Text>
        <Text style={styles.trim}>Roadster · Manual · 1.8L 4-cyl</Text>
        <View style={styles.hairline} />
        <Text style={styles.specLabel}>VIN</Text>
        <Text style={styles.vin}>SDE XAMPLE 00000001</Text>
      </View>
      <View style={styles.mrz}>
        {strip.map((line) => (
          <Text key={line} style={styles.mrzLine} numberOfLines={1}>
            {line}
          </Text>
        ))}
      </View>
    </Sheet>
  );
}

/** Left page of the first spread: the build log opens, owner one. */
export function LogLeftPage({ stage }: { stage: BookStage }) {
  return (
    <Sheet>
      <Text style={styles.pageTitle}>Build log</Text>
      <Text style={styles.chapter}>First owner</Text>
      <View style={styles.hairline} />
      <EntryRow kind="milestone" title="Delivered" miles={12} show />
      <EntryRow kind="service" title="First oil change" miles={4980} show={stage >= 1} />
      <View style={styles.lines}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.line} />
        ))}
      </View>
    </Sheet>
  );
}

/** Right page of the second spread: the log goes on. */
export function LogRightPage({ stage }: { stage: BookStage }) {
  return (
    <Sheet>
      <Text style={styles.pageTitle}>Build log</Text>
      <Text style={styles.chapter}>First owner, continued</Text>
      <View style={styles.hairline} />
      <EntryRow kind="mod" title="Coilovers and alignment" miles={31400} show={stage >= 2} />
      <View style={styles.lines}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.line} />
        ))}
      </View>
      <Text style={styles.foot}>Parts, photos and receipts stay with the entry.</Text>
    </Sheet>
  );
}

/** Left page of the last spread: the chapter closes, and the stamp comes down. */
export function SoldPage({ stage }: { stage: BookStage }) {
  return (
    <Sheet>
      <Text style={styles.pageTitle}>Chapter closed</Text>
      <Text style={styles.chapter}>First owner</Text>
      <View style={styles.hairline} />
      <View style={styles.stampArea}>
        <Stamp label="Sold" note="58,210 mi" tilt={-7} play={stage >= 3} />
      </View>
      <Text style={styles.foot}>Their time with the car stays credited to them.</Text>
    </Sheet>
  );
}

/** The last page: the second owner's chapter begins on top of the first. */
export function ChapterTwoPage({ stage }: { stage: BookStage }) {
  return (
    <Sheet>
      <Text style={styles.pageTitle}>Build log</Text>
      <Text style={styles.chapter}>Second owner</Text>
      <View style={styles.hairline} />
      <EntryRow kind="service" title="Fluids after purchase" miles={58340} show={stage >= 4} />
      <View style={styles.lines}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.line} />
        ))}
      </View>
      <Text style={styles.foot}>They read everything before them, then add their own chapter.</Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    width: PAGE_W,
    height: PAGE_H,
    backgroundColor: colors.paper,
    paddingHorizontal: 24,
    paddingTop: 26,
    overflow: 'hidden',
  },
  sheetShade: { backgroundColor: colors.paperShade },

  endpaper: { flex: 1, justifyContent: 'center', gap: 18 },
  rule: { height: 1, backgroundColor: colors.paperLine },
  endTitle: { fontFamily: fonts.displayBold, fontSize: 38, lineHeight: 38, color: colors.ink },
  endBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkMuted },
  endIssued: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.inkMuted },

  dataHead: { flexDirection: 'row', justifyContent: 'space-between' },
  docMono: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.5, color: colors.inkMuted },
  photo: {
    height: 150,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paperShade,
    borderRadius: radius.photo,
  },
  dataBody: { marginTop: 16 },
  make: { fontFamily: fonts.mono, fontSize: 11, color: colors.inkMuted, letterSpacing: 0.5 },
  model: { fontFamily: fonts.displayBold, fontSize: 38, lineHeight: 38, color: colors.ink, marginTop: 4 },
  trim: { fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted, marginTop: 4 },
  hairline: { height: 1, backgroundColor: colors.paperLine, marginVertical: 14 },
  specLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted },
  vin: { fontFamily: fonts.mono, fontSize: 14, color: colors.ink, letterSpacing: 0.5, marginTop: 2 },
  mrz: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: colors.paperShade,
  },
  mrzLine: { fontFamily: fonts.mono, fontSize: 10.2, lineHeight: 15, color: colors.inkMuted, letterSpacing: 0 },

  pageTitle: { fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 32, color: colors.ink },
  chapter: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.inkMuted, marginTop: 2 },
  entry: { flexDirection: 'row', gap: 12, paddingVertical: 11 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 3, marginTop: 5, backgroundColor: colors.paper },
  entryBody: { flex: 1 },
  entryTitle: { fontFamily: fonts.bodySemi, fontSize: 17, lineHeight: 22, color: colors.ink },
  entryMeta: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.inkMuted, marginTop: 1 },
  entryKind: { fontFamily: fonts.bodySemi },
  entryMiles: { fontFamily: fonts.bodyMedium, fontVariant: ['tabular-nums'] },
  lines: { marginTop: 14, gap: 26 },
  line: { height: 1, backgroundColor: colors.paperLine },
  foot: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 24,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.inkMuted,
  },
  stampArea: { height: 170, alignItems: 'center', justifyContent: 'center' },
});
