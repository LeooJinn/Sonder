import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Image,
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
  type ViewStyle,
} from 'react-native';
import { Link, Stack, useRouter } from 'expo-router';
import { LegalLinks } from '../components/LegalLinks';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadPassport, type Passport } from '../lib/passport';
import { KIND_LABELS, type EntryKind } from '../lib/log';
import { regionLabel } from '../lib/regions';
import { ordinal } from '../lib/dates';
import { Odometer } from '../components/Odometer';
import { OdometerTape } from '../components/OdometerTape';
import { DataPage } from '../components/DataPage';
import { LogoMark } from '../components/LogoMark';
import { CoverTexture } from '../components/CoverTexture';
import { Guilloche } from '../components/Guilloche';
import { PassportBook } from '../components/PassportBook';
import { Reveal } from '../components/Reveal';
import { TabIcon, type IconName } from '../components/TabIcon';
import { Tilt } from '../components/Tilt';
import { ownerName } from '../components/Timeline';
import { Button, focusRing, noOutline, type PressState } from '../components/ui';
import { colors, fonts, KIND_COLORS, object, radius, type, wideColumn } from '../lib/theme';
import { WIDE_BREAKPOINT } from '../components/useWide';

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

/** What else is in the app besides the logbook: the people around the cars. */
const COMMUNITY: { icon: IconName; title: string; body: string }[] = [
  { icon: 'following', title: 'Follow builds', body: 'Follow the people whose cars you like, and see what they log as they log it.' },
  { icon: 'market', title: 'Sell with the history', body: 'List a car from its passport. Buyers read every chapter before they message you.' },
  { icon: 'meets', title: 'Find meets', body: 'See what is happening in your region, or post a meet of your own.' },
  { icon: 'messages', title: 'Talk to people', body: 'Message the people you follow back, about a car, straight from its page.' },
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
  const wide = width >= WIDE_BREAKPOINT;

  const [vin, setVin] = useState('');
  const [passport, setPassport] = useState<Passport | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  // What the instrument is showing: an event (whose mileage the drums hold),
  // or null while the drums roll between two events. Only ever an event with
  // its own mileage — the instrument must not pair an entry with a reading
  // it never had.
  const [shown, setShown] = useState<{ event: number | null; owner: 1 | 2 }>({ event: 0, owner: 1 });
  const [heroHeight, setHeroHeight] = useState(0);
  // Narrow screens only: whether the band has docked. The band stays out of
  // the way of screen readers until then, so the reading isn't announced twice.
  const [docked, setDocked] = useState(false);

  // The odometer's reading and the passport's clock, both driven by scroll
  // without re-rendering the page. `story` counts life events: negative
  // while the hero is on screen, 0 at the first event, 1 at the second.
  const reading = useRef(new Animated.Value(LIFE[0].miles)).current;
  const story = useRef(new Animated.Value(-1)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const stageTop = useRef(0);
  const storyTop = useRef(0);
  const eventsTop = useRef(0);
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
   * Map scroll position to the story. Each life event owns a stretch of the
   * page from where its top crosses the upper third of the screen. For the
   * first half of that stretch the drums hold the event's own mileage; over
   * the second half they roll to the next event's, captioned as time on the
   * road rather than as either event. Reduced motion skips the roll: the
   * reading steps from one event's mileage to the next.
   *
   * The same position also sets the passport's clock: before the first event
   * it runs from -1 (the page's top) up to 0, which is when the cover opens.
   */
  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = event.nativeEvent.contentOffset.y;
    scrollY.setValue(y);
    const nowDocked = y > heroHeight - 120;
    if (nowDocked !== docked) setDocked(nowDocked);
    const base = stageTop.current + storyTop.current + eventsTop.current;
    const anchors = LIFE.map((_, i) => base + (stepTops.current[i] ?? 0) - height * 0.38);

    let i = 0;
    while (i < LIFE.length - 1 && y >= anchors[i + 1]) i++;
    const t =
      i === LIFE.length - 1 || y <= anchors[0]
        ? 0
        : Math.min(1, Math.max(0, (y - anchors[i]) / (anchors[i + 1] - anchors[i])));

    // the passport's clock
    if (y <= anchors[0]) {
      story.setValue(-Math.min(1, Math.max(0, (anchors[0] - y) / Math.max(1, anchors[0]))));
    } else {
      story.setValue(i + t);
    }

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
  const real = passport?.chapters[0];
  const proofPhotos = passport
    ? [
        ...(real?.gallery ?? []),
        ...passport.chapters.flatMap((c) => c.entries.flatMap((e) => e.photos)),
      ]
        .map((p) => p.url)
        .filter((u, i, all) => !!u && all.indexOf(u) === i)
        .slice(0, 3)
    : [];

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

  const topBar = (
    <View style={styles.topBar}>
      <View style={styles.brand}>
        <LogoMark size={34} />
        <Text style={styles.wordmark}>Sonder</Text>
      </View>
      <Button label="Sign in" variant="quiet" onPress={() => router.push('/sign-in')} />
    </View>
  );

  const offer = (
    <View>
      <Reveal rise={14}>
        <Text style={[styles.headline, wide && styles.headlineWide]} accessibilityRole="header">
          Every car has a life of its own.
        </Text>
      </Reveal>
      <Reveal rise={14} delay={120}>
        <Text style={[styles.lead, wide && styles.leadWide]}>
          Sonder keeps a car&apos;s history with the car. Every mod, service and repair is logged
          against its VIN, and handed to the next owner when it sells.
        </Text>
      </Reveal>
      <Reveal rise={14} delay={240}>
        <View style={[styles.actions, wide && styles.actionsWide]}>
          <Button
            label="Start a passport"
            onPress={() => router.push('/sign-in?mode=signup')}
            style={styles.primary}
            glint
          />
          <VinLookup value={vin} onChange={setVin} onSubmit={lookUp} />
        </View>
      </Reveal>
    </View>
  );

  const events = (
    <View style={styles.story} onLayout={(e: LayoutChangeEvent) => (storyTop.current = e.nativeEvent.layout.y)}>
      <Text style={styles.storyNote}>
        An example car&apos;s life. The entries here are illustrations
        {passport ? '; the passport further down is real.' : '.'}
      </Text>

      <View onLayout={(e: LayoutChangeEvent) => (eventsTop.current = e.nativeEvent.layout.y)}>
        {LIFE.map((event, i) => {
          const sale = i > 0 && event.owner !== LIFE[i - 1].owner;
          const ink = sale ? KIND_COLORS.milestone : KIND_COLORS[event.kind];
          return (
            <View
              key={event.entry}
              style={[styles.event, i === 0 && styles.eventFirst]}
              onLayout={(e: LayoutChangeEvent) => {
                stepTops.current[i] = e.nativeEvent.layout.y;
              }}
            >
              {/* the mileage, set huge and faint behind the entry, like a number printed on the page */}
              <Text
                style={[styles.ghost, wide && styles.ghostWide]}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                numberOfLines={1}
              >
                {event.miles.toLocaleString('en-US')}
              </Text>
              <View style={[styles.kindTag, { borderColor: ink }]}>
                <View style={[styles.kindDot, { backgroundColor: ink }]} />
                <Text style={[styles.kindTagText, { color: ink }]}>
                  {sale ? 'Sold' : KIND_LABELS[event.kind]}
                </Text>
                <Text style={styles.kindTagMiles}>{event.miles.toLocaleString('en-US')} mi</Text>
              </View>
              <Text style={[styles.eventHeading, wide && styles.eventHeadingWide]}>{event.heading}</Text>
              <Text style={styles.eventText}>{event.body}</Text>
              {sale ? (
                <View style={styles.stamp}>
                  <Text style={styles.stampTitle}>Sold</Text>
                  <Text style={styles.stampLine}>
                    {event.miles.toLocaleString('en-US')} mi, to its second owner
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );

  // The paper instrument: the odometer and what it is reading. Pinned under
  // the passport on wide screens; a band that sticks to the top on narrow ones.
  const instrument = (
    <View style={styles.instrument}>
      <OdometerTape reading={reading} tone="ground" />
      <View style={styles.instrumentCaption} accessibilityLiveRegion="polite">
        <Text style={[styles.bandUnit, styles.onGroundMuted]}>{ownerLine}</Text>
        <Text style={[styles.bandEvent, styles.onGround]} numberOfLines={2}>
          {eventLine}
        </Text>
      </View>
    </View>
  );

  const band = (
    <View
      style={styles.band}
      pointerEvents={docked ? 'auto' : 'none'}
      accessibilityElementsHidden={!docked}
      importantForAccessibility={docked ? 'auto' : 'no-hide-descendants'}
    >
      <View style={[styles.column, styles.bandInner, styles.bandInnerNarrow]}>
        <View style={styles.bandTape}>
          <OdometerTape reading={reading} tone="paper" compact />
        </View>
        <View style={styles.bandText} accessibilityLiveRegion="polite">
          <Text style={styles.bandUnit}>{ownerLine}</Text>
          <Text style={[styles.bandEvent, styles.bandEventNarrow]} numberOfLines={2}>
            {eventLine}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false, title: 'Sonder' }} />

      {/* wide screens: the bar floats over the stage so the passport can start at the very top */}
      {wide ? (
        <View style={[styles.topOverlay, { paddingTop: insets.top + 16 }]} pointerEvents="box-none">
          <View style={styles.stageColumn} pointerEvents="box-none">
            {topBar}
          </View>
        </View>
      ) : null}

      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        stickyHeaderIndices={wide ? undefined : [1]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
      >
        {wide ? (
          // 0 and 2 — the offer and the story, beside a passport that stays put
          // and opens as you read.
          <View onLayout={(e: LayoutChangeEvent) => (stageTop.current = e.nativeEvent.layout.y)}>
            <View style={[styles.stageColumn, styles.stageRow]}>
              <View style={styles.stageLeft}>
                <View
                  style={[styles.heroText, { paddingTop: insets.top + 120, minHeight: height }]}
                  onLayout={(e: LayoutChangeEvent) => setHeroHeight(e.nativeEvent.layout.height)}
                >
                  {offer}
                </View>
                {events}
              </View>
              <View style={styles.stageRight}>
                <View style={[styles.sticky, { height }]}>
                  <View style={styles.spotlight} pointerEvents="none" />
                  <View style={styles.bookArea}>
                    {/* Turning with the scroll is the reader's own movement, so it stays under reduced motion; the float and the tilt are what stop. */}
                    <PassportBook story={story} />
                  </View>
                  <View style={styles.instrumentDock}>{instrument}</View>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <>
            {/* 0 — the offer */}
            <View
              style={[styles.hero, { paddingTop: insets.top + 16 }]}
              onLayout={(e: LayoutChangeEvent) => setHeroHeight(e.nativeEvent.layout.height)}
            >
              <View style={styles.column}>
                {topBar}
                {offer}
                <View style={styles.bookNarrow}>
                  <PassportBook />
                </View>
              </View>
            </View>

            {/* 1 — the instrument band; sticks to the top as the story scrolls. */}
            {band}

            {/* 2 — the story */}
            <View onLayout={(e: LayoutChangeEvent) => (stageTop.current = e.nativeEvent.layout.y)}>
              <View style={styles.column}>{events}</View>
            </View>
          </>
        )}

        {/* 3 — the proof: a real car's own page, printed on paper edge to edge */}
        {passport ? (
          <View style={styles.proof}>
            <Guilloche opacity={0.5} />
            <View style={[styles.column, wide && styles.proofWide]}>
              <View style={[styles.proofText, wide && styles.proofTextWide]}>
                <Text style={[styles.proofHeading, wide && styles.proofHeadingWide]} accessibilityRole="header">
                  This one&apos;s real.
                </Text>
                <Text style={styles.proofBody}>
                  A {passport.vehicle.year} {passport.vehicle.make} {passport.vehicle.model} on its{' '}
                  {ordinal(passport.chapters.length)} owner, with every chapter of its history public
                  at one link.
                </Text>
                {proofPhotos.length > 1 ? (
                  <View style={styles.proofPhotos}>
                    {proofPhotos.slice(1).map((url) => (
                      <Image key={url} source={{ uri: url }} style={styles.proofPhoto} accessibilityLabel="" />
                    ))}
                  </View>
                ) : null}
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
                <Tilt>
                  <DataPage
                    vehicle={passport.vehicle}
                    photoUrl={proofPhotos[0]}
                    holder={realHolder}
                  />
                </Tilt>
              </View>
            </View>
          </View>
        ) : null}

        {/* 4 — the people around the cars */}
        <View style={styles.community}>
          <View style={styles.column}>
            <Text style={[styles.proofHeading, wide && styles.proofHeadingWide, styles.onGround]} accessibilityRole="header">
              More than a logbook.
            </Text>
            <Text style={[styles.proofBody, styles.onGroundMuted]}>
              Cars are better with people around them. Everything here starts from a car&apos;s own
              page.
            </Text>
            <View style={styles.bento}>
              {COMMUNITY.map((item, i) => (
                <Reveal key={item.title} index={i} style={[styles.bentoCell, wide && bentoWide(i)]}>
                  <CommunityCard {...item} paper={i === 0 || i === 3} />
                </Reveal>
              ))}
            </View>
          </View>
        </View>

        {/* 5 — the close */}
        <View style={styles.close}>
          <CoverTexture />
          <View style={[styles.column, styles.closeCentre]}>
            <Text style={[styles.closeHeading, wide && styles.closeHeadingWide]} accessibilityRole="header">
              Start your car&apos;s passport.
            </Text>
            <Text style={styles.closeBody}>
              Add it by VIN, log what&apos;s been done, and publish it when you&apos;re ready. Nothing
              is public until you say so.
            </Text>
            <Button
              label="Start a passport"
              onPress={() => router.push('/sign-in?mode=signup')}
              style={styles.closeButton}
              glint
            />
            {wide ? (
              <View style={styles.closeBook}>
                <PassportBook />
              </View>
            ) : null}
          </View>
          <View style={styles.column}>
            <Text style={styles.footer}>Sonder. Every car has a life of its own.</Text>
            <View style={styles.legal}>
              <LegalLinks align="left" />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/** Sizes in the grid: two wide cells on the diagonal, two narrow ones between. */
function bentoWide(i: number): ViewStyle {
  return { flexBasis: i === 0 || i === 3 ? '58%' : '38%', flexGrow: 1 };
}

/** One of the things around the logbook: a drawn pictogram, a name, a line. */
function CommunityCard({ icon, title, body, paper }: { icon: IconName; title: string; body: string; paper: boolean }) {
  // The pictogram plays its one motion as the card arrives.
  const [play, setPlay] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setPlay(true), 600);
    return () => clearTimeout(id);
  }, []);
  return (
    <View style={[styles.card, paper && styles.cardPaper]}>
      {paper ? <Guilloche /> : null}
      <TabIcon
        name={icon}
        active={play}
        color={paper ? colors.ink : colors.accent}
        accent={paper ? colors.inkMuted : colors.text}
        size={44}
      />
      <View>
        <Text style={[styles.cardTitle, paper && { color: colors.ink }]}>{title}</Text>
        <Text style={[styles.cardBody, paper && { color: colors.inkMuted }]}>{body}</Text>
      </View>
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
  heroText: { justifyContent: 'center' },
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
  headlineWide: { fontFamily: fonts.displayBold, fontSize: 108, lineHeight: 100, letterSpacing: -1.8 },
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
  onGround: { color: colors.text },
  onGroundMuted: { color: colors.textMuted },
  bandUnit: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.inkMuted },
  bandEvent: { fontFamily: fonts.display, fontSize: 20, lineHeight: 24, color: colors.ink },
  bandEventNarrow: { fontSize: type.item.fontSize, lineHeight: 21 },

  story: { paddingTop: 44 },
  storyNote: { ...type.small, color: colors.textFaint, maxWidth: 520, marginBottom: 28 },
  event: { paddingVertical: 56, borderTopWidth: 1, borderTopColor: colors.border, minHeight: 360, justifyContent: 'center' },
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
  eventHeadingWide: { fontSize: 56, lineHeight: 54 },
  eventText: { ...type.lead, color: colors.textMuted, marginTop: 12, maxWidth: 560 },

  proof: { backgroundColor: colors.paper, paddingVertical: 96, overflow: 'hidden' },
  proofWide: { flexDirection: 'row', gap: 56, alignItems: 'center' },
  proofText: { marginBottom: 24 },
  proofTextWide: { flex: 1, marginBottom: 0 },
  proofHeading: { ...type.display, color: colors.ink },
  proofBody: { ...type.lead, color: colors.inkMuted, marginTop: 14, maxWidth: 460 },
  proofLink: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: 28 },
  proofLinkText: { fontFamily: fonts.bodySemi, fontSize: 17, color: colors.ink, textDecorationLine: 'underline' },
  proofPage: { maxWidth: 520, width: '100%' },
  proofPageWide: { flex: 1 },

  close: { paddingTop: 112, overflow: 'hidden' },
  closeHeading: { ...type.hero, color: colors.text, textAlign: 'center' },
  closeBody: { ...type.lead, color: colors.textMuted, marginTop: 18, maxWidth: 520, textAlign: 'center' },
  closeButton: { alignSelf: 'center', marginTop: 28, paddingHorizontal: 36 },
  footer: { ...type.small, color: colors.textFaint, marginTop: 56 },
  legal: { marginTop: 10 },

  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingBottom: 10, backgroundColor: colors.background },
  stageRow: { flexDirection: 'row', gap: 48, alignItems: 'flex-start' },
  stageLeft: { flex: 1, minWidth: 0 },
  stageRight: { width: 540, alignSelf: 'stretch' },
  sticky: { position: 'sticky' as ViewStyle['position'], top: 0, paddingTop: 72, paddingBottom: 24 },
  spotlight: {
    position: 'absolute',
    top: '4%',
    left: 0,
    right: '-12%',
    height: '74%',
    borderRadius: 600,
    backgroundColor: object.coverMid,
    opacity: 0.45,
  },
  bookArea: { flex: 1 },
  instrumentDock: { marginTop: 8 },
  instrument: { gap: 14, paddingVertical: 4 },
  instrumentCaption: { gap: 2 },
  bandTape: { flex: 1, minWidth: 0 },
  bookNarrow: { height: 420, marginTop: 24 },
  community: { paddingVertical: 96 },
  communityGrid: { marginTop: 28, gap: 14 },
  communityGridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  communityCellWide: { width: '48.8%' },
  card: { backgroundColor: colors.surface, borderRadius: radius.page, padding: 26, minHeight: 260, justifyContent: 'space-between', overflow: 'hidden' },
  cardTitle: { ...type.title, color: colors.text },
  cardBody: { ...type.body, color: colors.textMuted, marginTop: 6, maxWidth: 360 },
  closeWide: { flexDirection: 'row', alignItems: 'center', gap: 48 },
  closeText: {},
  closeTextWide: { flex: 1 },
  closeBook: { width: 520, height: 460, marginTop: 24 },

  stageColumn: { width: '100%', maxWidth: 1240, alignSelf: 'center', paddingHorizontal: 20 },
  eventFirst: { borderTopWidth: 0 },
  // The mileage, printed huge behind the entry: part of the page, not a label.
  ghost: {
    position: 'absolute',
    top: 24,
    left: -4,
    right: 0,
    fontFamily: fonts.displayBold,
    fontSize: 120,
    lineHeight: 120,
    color: colors.surface,
    fontVariant: ['tabular-nums'],
  },
  ghostWide: { fontSize: 168, lineHeight: 168, top: 8 },
  kindTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.tag,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 16,
    backgroundColor: colors.background,
  },
  kindDot: { width: 8, height: 8, borderRadius: 4 },
  kindTagText: { fontFamily: fonts.bodySemi, fontSize: 14 },
  kindTagMiles: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  proofHeadingWide: { ...type.poster, fontSize: 96, lineHeight: 90, color: colors.ink },
  proofPhotos: { flexDirection: 'row', gap: 10, marginTop: 28 },
  proofPhoto: { flex: 1, maxWidth: 200, aspectRatio: 4 / 3, borderRadius: radius.photo, backgroundColor: colors.paperShade },
  bento: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 40 },
  bentoCell: { width: '100%' },
  cardPaper: { backgroundColor: colors.paper },
  closeCentre: { alignItems: 'center' },
  closeHeadingWide: { fontSize: 104, lineHeight: 96, letterSpacing: -1.6 },
});
