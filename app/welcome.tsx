import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Link, Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadPassport, type Passport } from '../lib/passport';
import { KIND_LABELS, type EntryKind } from '../lib/log';
import { regionLabel } from '../lib/regions';
import { ordinal } from '../lib/dates';
import { Odometer } from '../components/Odometer';
import { DataPage } from '../components/DataPage';
import { LogoMark } from '../components/LogoMark';
import { ownerName } from '../components/Timeline';
import { Button, focusRing, noOutline, type PressState } from '../components/ui';
import { colors, fonts, KIND_COLORS, radius, type, wideColumn } from '../lib/theme';

/** The owner's real, published car: the proof under the story. */
const EXAMPLE_VIN = '1FMCU0G65LUA35573';

/** Share of each event's stretch of page where the drums hold its mileage. */
const HOLD = 0.5;

/**
 * A car's life, told along its odometer. These entries are illustrations,
 * and the page says so; the passport further down is the real thing.
 */
const LIFE: {
  miles: number;
  kind: EntryKind;
  owner: 1 | 2;
  entry: string;
  heading: string;
  body: string;
}[] = [
  {
    miles: 12,
    kind: 'milestone',
    owner: 1,
    entry: 'Delivered',
    heading: 'It starts with the VIN.',
    body: 'Add a car by its VIN and Sonder fills in what the factory built: year, make, model, engine, and where it was assembled.',
  },
  {
    miles: 4980,
    kind: 'service',
    owner: 1,
    entry: 'First oil change',
    heading: 'Every job gets written down.',
    body: 'The date, the mileage, the parts and what it cost, logged the day the work is done. Photos too.',
  },
  {
    miles: 31400,
    kind: 'mod',
    owner: 1,
    entry: 'Coilovers and alignment',
    heading: 'The build has a paper trail.',
    body: 'Parts go in with brand and part number, so anyone reading later knows exactly what is on the car and who fitted it.',
  },
  {
    miles: 58210,
    kind: 'milestone',
    owner: 2,
    entry: 'Sold',
    heading: "The owner changes. The odometer doesn't.",
    body: 'Mark the car as sold and its log goes with it. Your time with the car stays credited to you.',
  },
  {
    miles: 58340,
    kind: 'service',
    owner: 2,
    entry: 'Fluids after purchase',
    heading: 'The next owner starts where you left off.',
    body: 'They read everything that came before them, then add their own chapter on top.',
  },
];

/** A VIN's alphabet: seventeen characters, never I, O or Q. */
function cleanVin(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/[IOQ]/g, '')
    .slice(0, 17);
}

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = width >= 860;

  const [vin, setVin] = useState('');
  const [passport, setPassport] = useState<Passport | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  // What the instrument is showing: an event (whose mileage the drums hold),
  // or null while the drums roll between two events. Only ever an event with
  // its own mileage — the instrument must not pair an entry with a reading
  // it never had.
  const [shown, setShown] = useState<{ event: number | null; owner: 1 | 2 }>({ event: 0, owner: 1 });
  const [heroHeight, setHeroHeight] = useState(0);
  // Wide screens only: whether the band has docked. Until then the hero's
  // own instrument is the one on screen, and the band stays out of the way
  // of screen readers too, so the reading isn't announced twice.
  const [docked, setDocked] = useState(false);

  // The odometer's reading and the scroll position, driven by scroll without
  // re-rendering the page.
  const reading = useRef(new Animated.Value(LIFE[0].miles)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const storyTop = useRef(0);
  const stepTops = useRef<number[]>([]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    loadPassport(EXAMPLE_VIN).then(setPassport).catch(() => setPassport(null));
  }, []);

  function show(next: { event: number | null; owner: 1 | 2 }) {
    setShown((current) =>
      current.event === next.event && current.owner === next.owner ? current : next
    );
  }

  /**
   * Map scroll position to mileage. Each life event owns a stretch of the
   * page from where its top crosses the upper third of the screen. For the
   * first half of that stretch the drums hold the event's own mileage; over
   * the second half they roll to the next event's, captioned as time on the
   * road rather than as either event. Reduced motion skips the roll: the
   * reading steps from one event's mileage to the next.
   */
  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = event.nativeEvent.contentOffset.y;
    scrollY.setValue(y);
    const nowDocked = y > heroHeight - 120;
    if (nowDocked !== docked) setDocked(nowDocked);
    const anchors = LIFE.map((_, i) => storyTop.current + (stepTops.current[i] ?? 0) - height * 0.38);

    let i = 0;
    while (i < LIFE.length - 1 && y >= anchors[i + 1]) i++;
    const t =
      i === LIFE.length - 1 || y <= anchors[0]
        ? 0
        : Math.min(1, Math.max(0, (y - anchors[i]) / (anchors[i + 1] - anchors[i])));

    if (reduceMotion || t < HOLD) {
      reading.setValue(LIFE[i].miles);
      show({ event: i, owner: LIFE[i].owner });
      return;
    }
    const rolled = (t - HOLD) / (1 - HOLD);
    reading.setValue(LIFE[i].miles + rolled * (LIFE[i + 1].miles - LIFE[i].miles));
    show({ event: null, owner: LIFE[i].owner });
  }

  const lookUp = () => {
    if (vin.length === 17) router.push(`/p/${vin}`);
  };

  const ownerLine = `miles, ${shown.owner === 2 ? 'second owner' : 'first owner'}`;
  const eventLine = shown.event === null ? 'On the road' : LIFE[shown.event].entry;
  // On wide screens the hero carries the odometer at display scale, and the
  // band only appears once that one has scrolled away: it docks, rather than
  // showing the same instrument twice.
  const bandOpacity =
    wide && heroHeight > 0
      ? scrollY.interpolate({
          inputRange: [heroHeight - 120, heroHeight - 20],
          outputRange: [0, 1],
          extrapolate: 'clamp',
        })
      : 1;
  const real = passport?.chapters[0];
  const realHolder = real
    ? [
        `Kept by ${ownerName(real.owner, 'its owner')}${
          regionLabel(real.owner?.region) ? ` in ${regionLabel(real.owner?.region)}` : ''
        }.`,
        passport!.chapters.length > 1 ? `${ordinal(passport!.chapters.length)} owner on Sonder.` : '',
      ]
        .filter(Boolean)
        .join(' ')
    : undefined;

  const band = (
    <Animated.View
      style={[styles.band, wide && styles.bandFloating, { opacity: bandOpacity }]}
      pointerEvents={wide && !docked ? 'none' : 'auto'}
      accessibilityElementsHidden={wide && !docked}
      importantForAccessibility={wide && !docked ? 'no-hide-descendants' : 'auto'}
      aria-hidden={wide && !docked}
    >
      <View style={[styles.column, styles.bandInner, !wide && styles.bandInnerNarrow]}>
        <Odometer reading={reading} size={wide ? 52 : 34} />
        <View style={styles.bandText} accessibilityLiveRegion="polite">
          <Text style={styles.bandUnit}>{ownerLine}</Text>
          <Text style={[styles.bandEvent, !wide && styles.bandEventNarrow]} numberOfLines={2}>
            {eventLine}
          </Text>
        </View>
      </View>
    </Animated.View>
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false, title: 'Sonder' }} />

      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        stickyHeaderIndices={wide ? undefined : [1]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
      >
        {/* 0 — the offer */}
        <View
          style={[styles.hero, { paddingTop: insets.top + 16 }]}
          onLayout={(e: LayoutChangeEvent) => setHeroHeight(e.nativeEvent.layout.height)}
        >
          <View style={styles.column}>
            <View style={styles.topBar}>
              <View style={styles.brand}>
                <LogoMark size={34} />
                <Text style={styles.wordmark}>Sonder</Text>
              </View>
              <Button label="Sign in" variant="quiet" onPress={() => router.push('/sign-in')} />
            </View>

            <View style={wide && styles.heroRow}>
              <View style={wide && styles.heroText}>
                <Text
                  style={[styles.headline, wide && styles.headlineWide]}
                  accessibilityRole="header"
                >
                  Every car has a life of its own.
                </Text>
                <Text style={[styles.lead, wide && styles.leadWide]}>
                  Sonder keeps a car&apos;s history with the car. Every mod, service and repair is
                  logged against its VIN, and handed to the next owner when it sells.
                </Text>

                <View style={[styles.actions, wide && styles.actionsWide]}>
                  <Button
                    label="Start a passport"
                    onPress={() => router.push('/sign-in?mode=signup')}
                    style={styles.primary}
                    glint
                  />
                  <VinLookup value={vin} onChange={setVin} onSubmit={lookUp} />
                </View>
              </View>

              {wide ? (
                <View style={styles.heroInstrument}>
                  <Odometer reading={reading} size={80} />
                  <Text style={styles.heroUnit}>{ownerLine}</Text>
                  <Text style={styles.heroEvent}>{eventLine}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* 1 — the instrument band; sticks to the top as the story scrolls.
            Wide screens float it over the page instead (below), so it takes
            no space until it docks. */}
        {wide ? null : band}

        {/* 2 — the story */}
        <View
          style={styles.story}
          onLayout={(e: LayoutChangeEvent) => {
            storyTop.current = e.nativeEvent.layout.y;
          }}
        >
          <View style={styles.column}>
            <Text style={styles.storyNote}>
              An example car&apos;s life. The entries here are illustrations
              {passport ? '; the passport further down is real.' : '.'}
            </Text>

            {LIFE.map((event, i) => {
              const sale = i > 0 && event.owner !== LIFE[i - 1].owner;
              return (
                <View
                  key={event.entry}
                  style={styles.event}
                  onLayout={(e: LayoutChangeEvent) => {
                    stepTops.current[i] = e.nativeEvent.layout.y;
                  }}
                >
                  <View style={styles.rail}>
                    <View style={[styles.railLine, i === 0 && styles.railLineFirst, i === LIFE.length - 1 && styles.railLineLast]} />
                    {sale ? (
                      <View style={styles.saleMark} />
                    ) : (
                      <View style={[styles.dot, { borderColor: KIND_COLORS[event.kind] }]} />
                    )}
                  </View>
                  <View style={styles.eventBody}>
                    <Text style={[styles.eventHeading, wide && styles.eventHeadingWide]}>{event.heading}</Text>
                    <Text style={styles.eventText}>{event.body}</Text>
                    {sale ? (
                      // The change of owner, marked the way a passport marks a
                      // crossing: a stamp, not a label.
                      <View style={styles.stamp}>
                        <Text style={styles.stampTitle}>Sold</Text>
                        <Text style={styles.stampLine}>
                          {event.miles.toLocaleString('en-US')} mi, to its second owner
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.eventMeta}>
                        <Text style={[styles.eventKind, { color: KIND_COLORS[event.kind] }]}>
                          {KIND_LABELS[event.kind]}
                        </Text>
                        {' logged at '}
                        <Text style={styles.eventMiles}>{event.miles.toLocaleString('en-US')} mi</Text>
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* 3 — the proof */}
        {passport ? (
          <View style={styles.proof}>
            <View style={[styles.column, wide && styles.proofWide]}>
              <View style={[styles.proofText, wide && styles.proofTextWide]}>
                <Text style={styles.proofHeading} accessibilityRole="header">
                  This one&apos;s real.
                </Text>
                <Text style={styles.proofBody}>
                  A {passport.vehicle.year} {passport.vehicle.make} {passport.vehicle.model} on its{' '}
                  {ordinal(passport.chapters.length)} owner, with every chapter of its history public
                  at one link.
                </Text>
                <Link href={`/p/${EXAMPLE_VIN}`} asChild>
                  <Pressable
                    accessibilityRole="link"
                    style={(state) => [styles.proofLink, (state as PressState).focused && focusRing]}
                  >
                    <Text style={styles.proofLinkText}>Read its passport</Text>
                  </Pressable>
                </Link>
              </View>
              <View style={[styles.proofPage, wide && styles.proofPageWide]}>
                <DataPage
                  vehicle={passport.vehicle}
                  photoUrl={
                    real?.gallery[0]?.url ??
                    passport.chapters.flatMap((c) => c.entries).find((e) => e.photos.length)?.photos[0]?.url
                  }
                  holder={realHolder}
                />
              </View>
            </View>
          </View>
        ) : null}

        {/* 4 — the close */}
        <View style={styles.close}>
          <View style={styles.column}>
            <Text style={styles.closeHeading} accessibilityRole="header">
              Start your car&apos;s passport.
            </Text>
            <Text style={styles.closeBody}>
              Add it by VIN, log what&apos;s been done, and publish it when you&apos;re ready. Nothing is
              public until you say so.
            </Text>
            <Button
              label="Start a passport"
              onPress={() => router.push('/sign-in?mode=signup')}
              style={styles.closeButton}
            />
            <Text style={styles.footer}>Sonder. Every car has a life of its own.</Text>
          </View>
        </View>
      </ScrollView>

      {wide ? band : null}
    </View>
  );
}

/** A compact VIN field for the front page: one line, not seventeen boxes. */
function VinLookup({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (vin: string) => void;
  onSubmit: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const ready = value.length === 17;

  return (
    <View style={[styles.lookup, focused && styles.lookupFocused]}>
      <TextInput
        value={value}
        onChangeText={(text) => onChange(cleanVin(text))}
        onSubmitEditing={onSubmit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Look up a VIN"
        placeholderTextColor={colors.textFaint}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={24}
        accessibilityLabel="Vehicle identification number, 17 characters"
        style={[styles.lookupInput, !value && styles.lookupInputEmpty, noOutline]}
      />
      <Pressable
        onPress={onSubmit}
        disabled={!ready}
        accessibilityRole="button"
        accessibilityLabel="Look up this VIN"
        accessibilityState={{ disabled: !ready }}
        style={(state) => [
          styles.lookupGo,
          !ready && styles.lookupGoIdle,
          (state as PressState).focused && focusRing,
        ]}
      >
        <Text style={[styles.lookupGoText, !ready && styles.lookupGoTextIdle]}>
          {ready ? 'Look it up' : `${17 - value.length} to go`}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  column: wideColumn,

  hero: { paddingBottom: 36 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 48 },
  heroText: { flex: 1.15 },
  heroInstrument: {
    flex: 1,
    alignItems: 'flex-start',
    backgroundColor: colors.paper,
    borderRadius: radius.page,
    padding: 28,
  },
  heroUnit: { fontFamily: fonts.bodySemi, fontSize: type.compact.fontSize, color: colors.inkMuted, marginTop: 18 },
  heroEvent: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: colors.ink, marginTop: 2 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
    marginBottom: 40,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordmark: { fontFamily: fonts.displayBold, fontSize: 26, color: colors.accent, letterSpacing: 0.5 },
  headline: { ...type.hero, color: colors.text, maxWidth: 820 },
  headlineWide: type.poster,
  lead: { ...type.lead, color: colors.textMuted, marginTop: 20, maxWidth: 560 },
  leadWide: { fontSize: 20, lineHeight: 30 },
  actions: { marginTop: 28, gap: 12 },
  actionsWide: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  primary: { paddingHorizontal: 28 },

  lookup: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingLeft: 16,
    paddingRight: 6,
    maxWidth: 440,
    flexGrow: 1,
  },
  lookupFocused: { borderColor: colors.accent },
  lookupInput: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: type.compact.fontSize,
    letterSpacing: 0.5,
    color: colors.text,
    paddingVertical: 12,
  },
  // The placeholder is words; only a typed VIN is set as machine data.
  lookupInputEmpty: { fontFamily: fonts.bodyMedium, fontSize: 16, letterSpacing: 0 },
  lookupGo: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.input,
    backgroundColor: colors.paper,
    justifyContent: 'center',
  },
  lookupGoIdle: { backgroundColor: 'transparent' },
  lookupGoText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
  lookupGoTextIdle: { fontFamily: fonts.bodyMedium, color: colors.textFaint },

  band: {
    backgroundColor: colors.paper,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.paperLine,
  },
  bandFloating: { position: 'absolute', top: 0, left: 0, right: 0 },
  bandInner: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  bandInnerNarrow: { gap: 12 },
  bandText: { flex: 1 },
  bandUnit: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.inkMuted },
  bandEvent: { fontFamily: fonts.display, fontSize: 20, lineHeight: 24, color: colors.ink },
  bandEventNarrow: { fontSize: type.item.fontSize, lineHeight: 21 },

  story: { paddingTop: 44 },
  storyNote: { ...type.small, color: colors.textFaint, maxWidth: 520, marginBottom: 28 },
  event: { flexDirection: 'row', minHeight: 300 },
  rail: { width: 28, alignItems: 'center' },
  railLine: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: colors.border },
  railLineFirst: { top: 14 },
  railLineLast: { bottom: undefined, height: 14 },
  dot: {
    marginTop: 9,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
    backgroundColor: colors.background,
  },
  saleMark: {
    marginTop: 9,
    width: 12,
    height: 12,
    backgroundColor: KIND_COLORS.milestone,
    transform: [{ rotate: '45deg' }],
  },
  eventBody: { flex: 1, paddingLeft: 14, paddingBottom: 72, maxWidth: 640 },
  eventMeta: { fontFamily: fonts.body, fontSize: type.compact.fontSize, lineHeight: 20, color: colors.textMuted, marginTop: 16 },
  eventKind: { fontFamily: fonts.bodySemi },
  // Barlow's tabular figures: the mono's comma is a full cell wide.
  eventMiles: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  eventHeading: { ...type.display, color: colors.text, marginTop: 2 },
  stamp: {
    alignSelf: 'flex-start',
    marginTop: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 2,
    // Milestone ink, like the sale's marker on the rail. Foil is kept for
    // the way on; a stamp in foil would read as a second call to action.
    borderColor: KIND_COLORS.milestone,
    borderRadius: radius.photo,
    transform: [{ rotate: '-4deg' }],
  },
  stampTitle: { fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 32, color: KIND_COLORS.milestone },
  stampLine: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: KIND_COLORS.milestone,
    fontVariant: ['tabular-nums'],
  },
  eventHeadingWide: { fontSize: type.hero.fontSize, lineHeight: type.hero.lineHeight },
  eventText: { ...type.lead, color: colors.textMuted, marginTop: 12, maxWidth: 560 },

  proof: { paddingVertical: 56, borderTopWidth: 1, borderTopColor: colors.border },
  proofWide: { flexDirection: 'row', gap: 56, alignItems: 'center' },
  proofText: { marginBottom: 24 },
  proofTextWide: { flex: 1, marginBottom: 0 },
  proofHeading: { ...type.display, color: colors.text },
  proofBody: { ...type.lead, color: colors.textMuted, marginTop: 12, maxWidth: 440 },
  proofLink: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: 16 },
  proofLinkText: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.accent },
  proofPage: { maxWidth: 520, width: '100%' },
  proofPageWide: { flex: 1 },

  close: { paddingTop: 56, borderTopWidth: 1, borderTopColor: colors.border },
  closeHeading: { ...type.hero, color: colors.text },
  closeBody: { ...type.lead, color: colors.textMuted, marginTop: 14, maxWidth: 520 },
  closeButton: { alignSelf: 'flex-start', marginTop: 24, paddingHorizontal: 28 },
  footer: { ...type.small, color: colors.textFaint, marginTop: 56 },
});
