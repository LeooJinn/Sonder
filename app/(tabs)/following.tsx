import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
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
import { Reveal } from '../../components/Reveal';
import { SkeletonRow } from '../../components/Skeleton';
import { colors, column, fonts, KIND_COLORS, radius, type } from '../../lib/theme';

/**
 * What the cars and people a member follows have been doing, newest first.
 *
 * Written as a logbook, not a timeline of posts: each line says what happened
 * to which car, the way a service stamp would. The car leads every line
 * because on Sonder the car is the subject, and its owner is the byline.
 */
export default function FollowingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
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
          if (page.items.length === 0) {
            const profile = await loadMyProfile().catch(() => null);
            setPlace(regionLabel(profile?.region));
            setSuggestions(await loadSuggestions(profile?.region));
          }
        })
        .catch((e) => setError(describeError(e)));
    },
    [session]
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

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false, title: 'Following' }} />
      <CoverTexture />
      <FlatList
        data={items ?? []}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        onEndReached={more}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
        ListHeaderComponent={
          <Reveal rise={8} style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              Following
            </Text>
            <Text style={styles.intro}>
              New work on the cars you follow, and what the people you follow get up to.
            </Text>
          </Reveal>
        }
        renderItem={({ item, index }) => (
          <Reveal index={index} rise={12}>
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
              place={place}
              suggestions={suggestions}
              onOpen={(vin) => router.push(`/p/${vin}`)}
            />
          )
        }
      />
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
 * One line of the logbook. The headline is the event itself; the byline is
 * who and when. Entry photos are shown large, because a photo of the work is
 * most of why anyone follows a build.
 */
function FeedLine({ item, onPress }: { item: FeedItem; onPress: () => void }) {
  const who = item.actor ? ownerName(item.actor) : undefined;
  const when = formatAgo(item.at);

  let subject: string;
  let headline: string;
  let byline: string;
  let kindLabel: { text: string; color: string } | undefined;
  let photo: { url: string; thumbUrl?: string } | undefined;

  switch (item.kind) {
    case 'entry': {
      subject = carName(item.car);
      headline = item.entry.title;
      kindLabel = { text: KIND_LABELS[item.entry.kind], color: KIND_COLORS[item.entry.kind] };
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
      byline = `Listed by ${who ?? 'its owner'}, ${when}.`;
      break;
    case 'published':
      subject = carName(item.car);
      headline = 'Passport published';
      byline = `${who ?? 'Its owner'} put its history online, ${when}.`;
      break;
    case 'sold':
      subject = carName(item.car);
      headline = `Sold by ${who ?? 'its owner'} after ${heldFor(item.startedOn, item.endedOn)}`;
      byline = `In ${formatMonthYear(item.endedOn)}. The history stays with the car.`;
      break;
    case 'meet':
      subject = 'Meet';
      headline = item.meet.title;
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
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${subject}. ${kindLabel ? `${kindLabel.text}: ` : ''}${headline}. ${byline}`}
      style={(state) => {
        const { pressed, focused, hovered } = state as PressState;
        return [styles.line, (pressed || hovered) && styles.lineActive, focused && focusRing];
      }}
    >
      <View style={styles.lineRow}>
        {lead}
        <View style={styles.lineBody}>
          <Text style={styles.subject} numberOfLines={1}>
            {subject}
          </Text>
          <Text style={styles.headline}>{headline}</Text>
          <Text style={styles.byline}>
            {kindLabel ? <Text style={[styles.kind, { color: kindLabel.color }]}>{kindLabel.text}. </Text> : null}
            {byline}
          </Text>
        </View>
      </View>
      {photo ? (
        <PhotoImage
          url={photo.url}
          thumbUrl={photo.thumbUrl}
          style={styles.photo}
          resizeMode="cover"
          accessibilityLabel={`Photo from ${headline}`}
        />
      ) : null}
    </Pressable>
  );
}

function CarThumb({ car }: { car: { vehicle: { make: string }; photoUrl?: string; photoThumbUrl?: string } }) {
  if (car.photoUrl) {
    return (
      <PhotoImage
        url={car.photoUrl}
        thumbUrl={car.photoThumbUrl}
        style={styles.thumb}
        resizeMode="cover"
        accessibilityLabel=""
      />
    );
  }
  // No photo: the make's initial on paper, like a monogram on a document.
  return (
    <View style={[styles.thumb, styles.thumbBlank]}>
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

/**
 * A new member follows nothing, so the empty feed is where following gets
 * explained, with real cars to follow right there rather than a search box.
 */
function Empty({
  place,
  suggestions,
  onOpen,
}: {
  place?: string;
  suggestions: SuggestedCar[] | null;
  onOpen: (vin: string) => void;
}) {
  const nearby = place && suggestions?.some((s) => s.owner.region && regionLabel(s.owner.region) === place);

  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>Nothing followed yet</Text>
      <Text style={styles.emptyBody}>
        Follow a car and its new log entries show up here, and you&apos;ll know if it goes up for
        sale. Follow a person and you get all of their published cars and the meets they host.
      </Text>

      {suggestions === null ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : suggestions.length > 0 ? (
        <View style={styles.suggestions}>
          <Text style={styles.suggestTitle} accessibilityRole="header">
            {nearby ? `Recently published in ${place}` : 'Recently published'}
          </Text>
          {suggestions.map((car) => (
            <View key={car.vehicleId} style={styles.suggestion}>
              <Pressable
                onPress={() => onOpen(car.vehicle.vin)}
                accessibilityRole="link"
                style={(state) => {
                  const { pressed, focused } = state as PressState;
                  return [styles.suggestLink, pressed && styles.pressed, focused && focusRing];
                }}
              >
                <CarThumb car={car} />
                <View style={styles.lineBody}>
                  <Text style={styles.subject}>
                    {car.vehicle.year} {car.vehicle.make}
                  </Text>
                  <Text style={styles.suggestModel}>{car.vehicle.model}</Text>
                  <Text style={styles.byline}>
                    {ownerName(car.owner, 'A member')}
                    {car.owner.region ? `, ${regionLabel(car.owner.region)}` : ''}
                  </Text>
                </View>
              </Pressable>
              <FollowButton kind="car" id={car.vehicleId} name={carName(car)} compact />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const THUMB = 64;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: 20, paddingBottom: 32, flexGrow: 1, ...column },

  header: { paddingTop: 20, marginBottom: 16 },
  title: { ...type.hero, color: colors.text },
  intro: { ...type.body, color: colors.textMuted, marginTop: 10, maxWidth: 520 },

  loading: { marginTop: 8 },
  more: { marginVertical: 24 },

  line: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: radius.control,
  },
  lineActive: { backgroundColor: colors.surface },
  lineRow: { flexDirection: 'row', gap: 16 },
  lineBody: { flex: 1 },
  subject: { fontFamily: fonts.bodySemi, fontSize: type.compact.fontSize, lineHeight: 20, color: colors.textMuted },
  headline: { fontFamily: fonts.bodySemi, fontSize: type.item.fontSize, lineHeight: 24, color: colors.text, marginTop: 2 },
  byline: { ...type.small, color: colors.textFaint, marginTop: 4 },
  kind: { fontFamily: fonts.bodySemi },
  photo: {
    width: '100%',
    aspectRatio: 3 / 2,
    borderRadius: radius.photo,
    marginTop: 14,
    backgroundColor: colors.surface,
  },

  thumb: { width: THUMB, height: THUMB, borderRadius: radius.photo, backgroundColor: colors.surface },
  thumbBlank: { backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  thumbInitial: { fontFamily: fonts.displayBold, fontSize: 30, color: colors.inkMuted },

  sheet: {
    width: THUMB,
    backgroundColor: colors.paper,
    borderRadius: radius.input,
    alignItems: 'center',
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  sheetWeekday: { ...type.caption, color: colors.inkMuted },
  sheetDay: { fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 32, color: colors.ink },
  sheetMonth: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 16, color: colors.inkMuted },

  empty: { paddingTop: 8 },
  emptyTitle: { ...type.title, color: colors.text },
  emptyBody: { ...type.body, color: colors.textMuted, marginTop: 10, maxWidth: 520 },

  suggestions: { marginTop: 36 },
  suggestTitle: { ...type.heading, color: colors.text, marginBottom: 8 },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  suggestLink: { flex: 1, flexDirection: 'row', gap: 16, alignItems: 'center', borderRadius: radius.control },
  suggestModel: { fontFamily: fonts.display, fontSize: type.heading.fontSize, lineHeight: 26, color: colors.text },
  pressed: { opacity: 0.75 },
});
