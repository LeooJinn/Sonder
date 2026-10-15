import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadFeed, loadSuggestions, markFeedSeen, type FeedItem, type SuggestedCar } from '../../lib/feed';
import { loadMyProfile } from '../../lib/profile';
import { formatCents, KIND_LABELS } from '../../lib/log';
import { calendarSheet, formatAgo, formatClock, formatMonthYear } from '../../lib/dates';
import { regionLabel } from '../../lib/regions';
import { describeError } from '../../lib/errors';
import { useAuth } from '../../lib/auth';
import { PhotoImage } from '../../components/PhotoImage';
import { FollowButton } from '../../components/FollowButton';
import { ownerName } from '../../components/Timeline';
import { ErrorState, focusRing, type PressState } from '../../components/ui';
import { CoverTexture } from '../../components/CoverTexture';
import { Guilloche } from '../../components/Guilloche';
import { LiftPressable } from '../../components/LiftPressable';
import { Reveal } from '../../components/Reveal';
import { SkeletonRow } from '../../components/Skeleton';
import { TabIcon, type IconName } from '../../components/TabIcon';
import { colors, fonts, KIND_COLORS_ON_PAPER, radius, type } from '../../lib/theme';

/** The width at which the side rail appears and the feed gains a column beside it. */
const WIDE = 900;

/**
 * What the cars and people a member follows have been doing, newest first.
 *
 * Written as a logbook, not a timeline of posts: each line says what happened
 * to which car, the way a service stamp would. The car leads every line
 * because on Sonder the car is the subject, and its owner is the byline.
 *
 * Every line is a small paper page, because each one is about a specific car.
 * On a wide screen the feed sits beside a column of cars worth following.
 */
export default function FollowingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const { session } = useAuth();
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [nextBefore, setNextBefore] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedCar[] | null>(null);
  const [place, setPlace] = useState<string | undefined>();
  const loadedOnce = useRef(false);

  const load = useCallback(
    (quiet = false) => {
      if (!session) return;
      if (!quiet) setError(null);
      return loadFeed()
        .then(async (page) => {
          setItems(page.items);
          setNextBefore(page.nextBefore);
          loadedOnce.current = true;
          // The dot on the tab is about what arrived since this moment.
          markFeedSeen().catch(() => {});
          // An empty feed is where following gets explained, with cars to
          // follow. On a wide screen there is room to keep them beside a
          // feed that has things in it too.
          if (page.items.length === 0 || wide) {
            const profile = await loadMyProfile().catch(() => null);
            setPlace(regionLabel(profile?.region));
            setSuggestions(await loadSuggestions(profile?.region).catch(() => []));
          }
        })
        .catch((e) => setError(describeError(e)));
    },
    [session, wide]
  );

  // Reload on every visit, quietly after the first: the list stays put while
  // the new one loads rather than flashing a spinner.
  useFocusEffect(
    useCallback(() => {
      load(loadedOnce.current);
    }, [load])
  );

  async function refresh() {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }

  async function more() {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await loadFeed(nextBefore);
      setItems((current) => {
        const seen = new Set((current ?? []).map((item) => item.key));
        return [...(current ?? []), ...page.items.filter((item) => !seen.has(item.key))];
      });
      setNextBefore(page.nextBefore);
    } catch {
      // Leave the list as it is; scrolling again retries.
    } finally {
      setLoadingMore(false);
    }
  }

  function open(item: FeedItem) {
    if (item.kind === 'meet') router.push(`/meet/${item.meet.id}`);
    else router.push(`/p/${item.car.vehicle.vin}`);
  }

  const openCar = (vin: string) => router.push(`/p/${vin}`);
  // The side column needs room: the rail (236), a readable feed (about 560) and its own 380.
  const roomForAside = width >= ASIDE_MIN_WIDTH;
  const showAside = wide && roomForAside && !!suggestions && suggestions.length > 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false, title: 'Following' }} />
      <CoverTexture />
      <View style={wide ? styles.shell : styles.flex}>
        <FlatList
          style={styles.flex}
          data={items ?? []}
          keyExtractor={(item) => item.key}
          contentContainerStyle={[styles.list, wide && styles.listWide]}
          onEndReached={more}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
          ListHeaderComponent={
            <Reveal rise={8} style={styles.header}>
              <Text style={[styles.title, wide && styles.titleWide]} accessibilityRole="header">
                Following
              </Text>
              {wide && items && items.length > 0 ? (
                <Text style={styles.count}>
                  {items.length}
                  {nextBefore ? '+' : ''} recent {items.length === 1 && !nextBefore ? 'update' : 'updates'}
                </Text>
              ) : null}
              <Text style={styles.intro}>
                New work on the cars you follow, and what the people you follow get up to.
              </Text>
            </Reveal>
          }
          renderItem={({ item, index }) => (
            <Reveal index={index} rise={12} style={styles.cell}>
              <FeedLine item={item} onPress={() => open(item)} />
            </Reveal>
          )}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={colors.accent} style={styles.more} /> : null
          }
          ListEmptyComponent={
            error ? (
              <ErrorState message={error} onRetry={() => load()} />
            ) : items === null ? (
              <View style={styles.loading}>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </View>
            ) : (
              <Empty
                wide={wide}
                place={place}
                suggestions={showAside ? [] : suggestions}
                onOpen={openCar}
              />
            )
          }
        />

        {showAside ? (
          <ScrollView
            style={styles.aside}
            contentContainerStyle={[styles.asideContent, { paddingTop: 48 }]}
            showsVerticalScrollIndicator={false}
          >
            <Reveal rise={8} delay={200}>
              <Suggestions suggestions={suggestions ?? []} place={place} onOpen={openCar} flush />
            </Reveal>
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

/** "a few weeks", "8 months", "3 years": how long someone kept a car. */
function heldFor(startedOn: string, endedOn: string): string {
  const start = new Date(startedOn);
  const end = new Date(endedOn);
  const months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
  if (months < 1) return 'a few weeks';
  if (months < 12) return months === 1 ? 'a month' : `${months} months`;
  const years = Math.floor(months / 12);
  return years === 1 ? 'a year' : `${years} years`;
}

function carName(item: { vehicle: { year: string; make: string; model: string } }): string {
  return [item.vehicle.year, item.vehicle.make, item.vehicle.model].filter(Boolean).join(' ');
}

/**
 * One line of the logbook, printed on its own small page. The headline is the
 * event itself; the byline is who and when. Entry photos are shown large,
 * because a photo of the work is most of why anyone follows a build.
 */
function FeedLine({ item, onPress }: { item: FeedItem; onPress: () => void }) {
  const { width } = useWindowDimensions();
  const who = item.actor ? ownerName(item.actor) : undefined;
  const when = formatAgo(item.at);

  let subject: string;
  let headline: string;
  let byline: string;
  // What kind of thing this is, in its own ink: entries in their kind's, a sale
  // in the milestone lilac the rail uses for one, the rest in plain ink.
  let kindLabel: { text: string; color: string; spoken?: boolean };
  let photo: { url: string; thumbUrl?: string } | undefined;

  switch (item.kind) {
    case 'entry': {
      subject = carName(item.car);
      headline = item.entry.title;
      kindLabel = { text: KIND_LABELS[item.entry.kind], color: KIND_COLORS_ON_PAPER[item.entry.kind], spoken: true };
      const mileage = item.entry.odometer !== undefined ? ` at ${item.entry.odometer.toLocaleString('en-US')} mi` : '';
      byline = `${who ? `Logged by ${who}` : 'Logged'}${mileage}, ${when}.`;
      photo = item.entry.photos[0];
      break;
    }
    case 'listed':
      subject = carName(item.car);
      headline =
        item.askingPriceCents !== undefined
          ? `For sale at ${formatCents(item.askingPriceCents)}`
          : 'For sale, open to offers';
      kindLabel = { text: 'For sale', color: colors.ink };
      byline = `Listed by ${who ?? 'its owner'}, ${when}.`;
      break;
    case 'published':
      subject = carName(item.car);
      headline = 'Passport published';
      kindLabel = { text: 'Passport', color: colors.ink };
      byline = `${who ?? 'Its owner'} put its history online, ${when}.`;
      break;
    case 'sold':
      subject = carName(item.car);
      headline = `Sold by ${who ?? 'its owner'} after ${heldFor(item.startedOn, item.endedOn)}`;
      kindLabel = { text: 'Sold', color: KIND_COLORS_ON_PAPER.milestone };
      byline = `In ${formatMonthYear(item.endedOn)}. The history stays with the car.`;
      break;
    case 'meet':
      subject = 'Meet';
      headline = item.meet.title;
      kindLabel = { text: 'Meet', color: colors.ink };
      byline = `Hosted by ${who ?? 'a member'}. ${formatClock(item.meet.startsAt)}, ${item.meet.place}.`;
      break;
  }

  const lead =
    item.kind === 'meet' ? (
      <CalendarSheet iso={item.meet.startsAt} />
    ) : (
      <CarThumb car={item.car} />
    );

  return (
    <LiftPressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${subject}. ${kindLabel.spoken ? `${kindLabel.text}: ` : ''}${headline}. ${byline}`}
      style={(state) => {
        const { pressed, focused } = state as PressState;
        return [styles.line, pressed && styles.linePressed, focused && focusRing];
      }}
    >
      <Guilloche opacity={0.26} />
      <View style={styles.lineRow}>
        {lead}
        <View style={styles.lineBody}>
          <View style={styles.lineTop}>
            <Text style={styles.subject} numberOfLines={1}>
              {subject}
            </Text>
            <View style={styles.kindRow}>
              <View style={[styles.kindDot, { backgroundColor: kindLabel.color }]} />
              <Text style={[styles.kind, { color: kindLabel.color }]}>{kindLabel.text}</Text>
            </View>
          </View>
          <Text style={styles.headline}>{headline}</Text>
          <Text style={styles.byline}>{byline}</Text>
        </View>
      </View>
      {photo ? (
        <PhotoImage
          url={photo.url}
          thumbUrl={photo.thumbUrl}
          style={[styles.photo, width >= WIDE && styles.photoWide]}
          resizeMode="cover"
          accessibilityLabel={`Photo from ${headline}`}
        />
      ) : null}
    </LiftPressable>
  );
}

function CarThumb({
  car,
  size = THUMB,
}: {
  car: { vehicle: { make: string }; photoUrl?: string; photoThumbUrl?: string };
  size?: number;
}) {
  if (car.photoUrl) {
    return (
      <PhotoImage
        url={car.photoUrl}
        thumbUrl={car.photoThumbUrl}
        style={[styles.thumb, { width: size, height: size }]}
        resizeMode="cover"
        accessibilityLabel=""
      />
    );
  }
  // No photo: the make's initial on paper, like a monogram on a document.
  return (
    <View style={[styles.thumb, styles.thumbBlank, { width: size, height: size }]}>
      <Text style={styles.thumbInitial}>{car.vehicle.make.charAt(0) || '?'}</Text>
    </View>
  );
}

function CalendarSheet({ iso }: { iso: string }) {
  const sheet = calendarSheet(iso);
  return (
    <View style={styles.sheet}>
      <Text style={styles.sheetWeekday}>{sheet.weekday}</Text>
      <Text style={styles.sheetDay}>{sheet.day}</Text>
      <Text style={styles.sheetMonth}>{sheet.month}</Text>
    </View>
  );
}

/** Cars recently published, each with its follow button. Used inline on a phone, as a column on desktop. */
function Suggestions({
  suggestions,
  place,
  onOpen,
  flush,
}: {
  suggestions: SuggestedCar[];
  place?: string;
  onOpen: (vin: string) => void;
  /** No space above: it already starts the column. */
  flush?: boolean;
}) {
  const nearby = place && suggestions.some((s) => s.owner.region && regionLabel(s.owner.region) === place);

  return (
    <View style={[styles.suggestions, flush && styles.flush]}>
      <Text style={styles.suggestTitle} accessibilityRole="header">
        {nearby ? `Recently published in ${place}` : 'Recently published'}
      </Text>
      {suggestions.slice(0, 6).map((car, i) => (
        <Reveal key={car.vehicleId} index={i} rise={8} style={styles.suggestion}>
          <Pressable
            onPress={() => onOpen(car.vehicle.vin)}
            accessibilityRole="link"
            style={(state) => {
              const { pressed, hovered, focused } = state as PressState;
              return [styles.suggestLink, (pressed || hovered) && styles.suggestActive, focused && focusRing];
            }}
          >
            <CarThumb car={car} />
            <View style={styles.lineBody}>
              <Text style={styles.suggestMake}>
                {car.vehicle.year} {car.vehicle.make}
              </Text>
              <Text style={styles.suggestModel}>{car.vehicle.model}</Text>
              <Text style={styles.suggestBy} numberOfLines={1}>
                {ownerName(car.owner, 'A member')}
                {car.owner.region ? `, ${regionLabel(car.owner.region)}` : ''}
              </Text>
            </View>
          </Pressable>
          <FollowButton kind="car" id={car.vehicleId} name={carName(car)} compact />
        </Reveal>
      ))}
    </View>
  );
}

const WAYS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'garage', title: 'Follow a car', body: 'Its new log entries show up here, and you will know if it goes up for sale.' },
  { icon: 'following', title: 'Follow a person', body: 'Get all of their published cars, and the meets they host.' },
  { icon: 'meets', title: 'Come back often', body: 'This is a logbook, not a stream: it only ever says what happened to a car.' },
];

/**
 * A new member follows nothing, so the empty feed is where following gets
 * explained. On a phone it carries real cars to follow right there rather
 * than a search box; on desktop they wait in the column beside it.
 */
function Empty({
  wide,
  place,
  suggestions,
  onOpen,
}: {
  wide: boolean;
  place?: string;
  suggestions: SuggestedCar[] | null;
  onOpen: (vin: string) => void;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>Nothing followed yet</Text>
      <Text style={styles.emptyBody}>
        Follow a car and its new log entries show up here, and you&apos;ll know if it goes up for
        sale. Follow a person and you get all of their published cars and the meets they host.
      </Text>

      {wide ? (
        <View style={styles.ways}>
          {WAYS.map((way, i) => (
            <Reveal key={way.title} index={i} rise={8} style={styles.wayCell}>
              <View style={styles.way}>
                <Guilloche opacity={0.26} />
                <TabIcon name={way.icon} active color={colors.ink} accent={colors.inkMuted} size={32} />
                <Text style={styles.wayTitle}>{way.title}</Text>
                <Text style={styles.wayBody}>{way.body}</Text>
              </View>
            </Reveal>
          ))}
        </View>
      ) : suggestions === null ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : null}
      {suggestions && suggestions.length > 0 ? (
        <Suggestions suggestions={suggestions} place={place} onOpen={onOpen} />
      ) : null}
    </View>
  );
}

const THUMB = 64;
/** Below this window width the feed takes the whole content area and the side column steps aside. */
const ASIDE_MIN_WIDTH = 1180;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  shell: { flex: 1, flexDirection: 'row', width: '100%', maxWidth: 1240, alignSelf: 'center' },
  list: { paddingHorizontal: 20, paddingBottom: 32, flexGrow: 1, width: '100%', maxWidth: 640, alignSelf: 'center' },
  listWide: { maxWidth: 800, paddingHorizontal: 48, paddingTop: 48, paddingBottom: 64, alignSelf: 'stretch' },

  header: { paddingTop: 20, marginBottom: 20 },
  title: { ...type.hero, color: colors.text },
  titleWide: { fontSize: 72, lineHeight: 68 },
  count: { ...type.lead, color: colors.textMuted, marginTop: 8 },
  intro: { ...type.body, color: colors.textMuted, marginTop: 10, maxWidth: 520 },

  loading: { marginTop: 8 },
  more: { marginVertical: 24 },
  cell: { marginBottom: 16 },

  // One logbook line, on its own page of security paper.
  line: { backgroundColor: colors.paper, borderRadius: radius.page, padding: 18, overflow: 'hidden' },
  linePressed: { opacity: 0.85 },
  lineRow: { flexDirection: 'row', gap: 16 },
  lineBody: { flex: 1, minWidth: 0 },
  lineTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  subject: { flexShrink: 1, fontFamily: fonts.bodySemi, fontSize: type.compact.fontSize, lineHeight: 20, color: colors.inkMuted },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kindDot: { width: 8, height: 8, borderRadius: 4 },
  kind: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 18 },
  headline: { fontFamily: fonts.displayBold, fontSize: 26, lineHeight: 28, color: colors.ink, marginTop: 4 },
  byline: { ...type.small, color: colors.inkMuted, marginTop: 6 },
  photo: {
    width: '100%',
    aspectRatio: 3 / 2,
    borderRadius: radius.photo,
    marginTop: 16,
    backgroundColor: colors.paperShade,
  },

  photoWide: { aspectRatio: 16 / 9 },
  thumb: { borderRadius: radius.photo, backgroundColor: colors.paperShade },
  thumbBlank: { alignItems: 'center', justifyContent: 'center' },
  thumbInitial: { fontFamily: fonts.displayBold, fontSize: 30, color: colors.inkMuted },

  sheet: {
    width: THUMB,
    backgroundColor: colors.paperShade,
    borderRadius: radius.input,
    alignItems: 'center',
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  sheetWeekday: { ...type.caption, color: colors.inkMuted },
  sheetDay: { fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 32, color: colors.ink },
  sheetMonth: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 16, color: colors.inkMuted },

  // A ScrollView grows by default on the web; pinned so it can't take the feed's width.
  aside: { width: 380, flexGrow: 0, flexShrink: 0 },
  asideContent: { paddingRight: 48, paddingBottom: 64 },

  empty: { paddingTop: 8 },
  emptyTitle: { ...type.title, color: colors.text },
  emptyBody: { ...type.body, color: colors.textMuted, marginTop: 10, maxWidth: 520 },
  ways: { marginTop: 32, flexDirection: 'row', gap: 16 },
  wayCell: { flex: 1 },
  way: { flex: 1, backgroundColor: colors.paper, borderRadius: radius.page, padding: 22, gap: 6, overflow: 'hidden' },
  wayTitle: { ...type.title, fontSize: 24, lineHeight: 26, color: colors.ink, marginTop: 8 },
  wayBody: { ...type.body, color: colors.inkMuted, maxWidth: 460 },

  suggestions: { marginTop: 36 },
  flush: { marginTop: 0 },
  suggestTitle: { ...type.heading, color: colors.text, marginBottom: 8 },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  suggestLink: { flex: 1, flexDirection: 'row', gap: 14, alignItems: 'center', borderRadius: radius.control, padding: 4 },
  suggestActive: { backgroundColor: colors.surface },
  suggestMake: { fontFamily: fonts.bodySemi, fontSize: type.compact.fontSize, lineHeight: 20, color: colors.textMuted },
  suggestModel: { fontFamily: fonts.display, fontSize: type.heading.fontSize, lineHeight: 26, color: colors.text },
  suggestBy: { ...type.small, color: colors.textFaint, marginTop: 2 },
});
