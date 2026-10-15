import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { PhotoImage } from '../../components/PhotoImage';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadGarage, type SavedVehicle } from '../../lib/garage';
import { useAuth } from '../../lib/auth';
import { describeError } from '../../lib/errors';
import { loadGarageReminders, type ReminderStatus } from '../../lib/reminders';
import { formatMonthYear } from '../../lib/dates';
import { groupVin } from '../../components/DataPage';
import { CarDrawing } from '../../components/CarDrawing';
import { CoverTexture } from '../../components/CoverTexture';
import { Guilloche } from '../../components/Guilloche';
import { Odometer } from '../../components/Odometer';
import { ParkingBay } from '../../components/ParkingBay';
import { Reveal } from '../../components/Reveal';
import { SkeletonCard } from '../../components/Skeleton';
import { duration, ease, nativeDriver, useReducedMotion } from '../../lib/motion';
import { Button, ErrorState, focusRing, type PressState } from '../../components/ui';
import { colors, column, fonts, radius, type } from '../../lib/theme';
import { WIDE_BREAKPOINT } from '../../components/useWide';

/** A stand-in row for the "add a car" bay, so it sits in the grid with the cars. */
const BAY = { vin: '__bay__' } as unknown as SavedVehicle;

export default function GarageScreen() {
  const [garage, setGarage] = useState<SavedVehicle[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [due, setDue] = useState<Map<string, { title: string; status: ReminderStatus }>>(new Map());
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Wide screens get the side rail (see _layout), so the screen drops its own
  // wordmark and Profile link and lays the cars out as a grid.
  const wide = width >= WIDE_BREAKPOINT;
  const { session } = useAuth();

  /**
   * useFocusEffect runs every time this screen comes into view — including
   * when you navigate *back* to it. A plain useEffect would only run once,
   * so a car added on another screen wouldn't show up until a restart.
   *
   * useCallback stops the effect re-running on every render.
   *
   * Waits for a session: on a signed-out visit this screen mounts for a
   * moment before the guard redirects to sign-in, and loading then would
   * only fail.
   */
  const load = useCallback(() => {
    if (!session) return;
    setError(null);
    loadGarage()
      .then((vehicles) => {
        setGarage(vehicles);
        setLoaded(true);
      })
      .catch((e) => setError(describeError(e)));
    // Reminders are extra: the garage shows without them if they fail.
    loadGarageReminders().then(setDue).catch(() => {});
  }, [session]);

  useFocusEffect(load);

  const isEmpty = loaded && garage.length === 0;

  if (error && !loaded) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false, title: 'Garage' }} />
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false, title: 'Garage' }} />
      <CoverTexture />

      <FlatList
        // numColumns can't change on a mounted list, so a change of layout remounts it.
        key={wide ? 'grid' : 'column'}
        numColumns={wide ? 2 : 1}
        columnWrapperStyle={wide ? styles.gridRow : undefined}
        data={wide && loaded && !isEmpty ? [...garage, BAY] : garage}
        keyExtractor={(vehicle) => vehicle.vin}
        contentContainerStyle={[styles.list, wide && styles.listWide]}
        ListHeaderComponent={
          <Reveal rise={8} style={styles.header}>
            {wide ? null : (
              <View style={styles.topBar}>
                <Text style={styles.wordmark}>Sonder</Text>
                <Button label="Profile" variant="quiet" onPress={() => router.push('/profile')} />
              </View>
            )}
            {loaded && !isEmpty ? (
              <View style={styles.titleRow}>
                <View>
                  <Text style={[styles.title, wide && styles.titleWide]} accessibilityRole="header">
                    Garage
                  </Text>
                  {wide ? (
                    <Text style={styles.count}>
                      {garage.length} {garage.length === 1 ? 'car' : 'cars'}
                      {due.size > 0 ? `, ${due.size} with something due` : ''}
                    </Text>
                  ) : null}
                </View>
                <Button label="Add a car" variant="quiet" onPress={() => router.push('/add')} />
              </View>
            ) : null}
          </Reveal>
        }
        renderItem={({ item, index }) =>
          item === BAY ? (
            <Reveal index={index} style={styles.cell}>
              <ParkingBay number={garage.length + 1} onPress={() => router.push('/add')} />
            </Reveal>
          ) : (
            <Reveal index={index} style={wide ? styles.cell : undefined}>
              <GarageCard
                vehicle={item}
                index={index}
                due={due.get(item.vin)}
                fill={wide}
                onPress={() => router.push(`/vehicle/${item.vin}`)}
              />
            </Reveal>
          )
        }
        ListFooterComponent={
          loaded && !isEmpty && !wide ? (
            <Reveal index={garage.length} style={styles.bay}>
              <ParkingBay number={garage.length + 1} onPress={() => router.push('/add')} />
            </Reveal>
          ) : null
        }
        // Only show the empty state once we've actually checked, otherwise it
        // flashes for a moment on every launch.
        ListEmptyComponent={
          !loaded ? (
            <View style={[styles.skeletons, wide && styles.skeletonsWide]}>
              <View style={wide ? styles.skeletonCell : undefined}>
                <SkeletonCard />
              </View>
              <View style={wide ? styles.skeletonCell : undefined}>
                <SkeletonCard />
              </View>
            </View>
          ) : isEmpty ? (
            <View style={styles.empty}>
              <Reveal rise={0}>
                <CarDrawing width={300} />
              </Reveal>
              <Text style={styles.emptyTitle} accessibilityRole="header">
                Your garage is empty
              </Text>
              <Text style={styles.emptyBody}>
                Add a car by its VIN. Sonder looks up the year, make, model and factory specs,
                and the car is ready for its first log entry.
              </Text>
              <Text style={styles.emptyHint}>
                The VIN is on the driver&apos;s side of the dashboard, readable through the
                windshield, and on the sticker inside the driver&apos;s door.
              </Text>
              <Button label="Add a car" onPress={() => router.push('/add')} style={styles.emptyButton} glint />
            </View>
          ) : null
        }
      />
    </View>
  );
}

/**
 * A car in the garage. The photo carries it; the strip underneath is set in
 * the same type as its data page, so the two read as one object. It is
 * printed on engraved paper, and its last logged mileage rolls up on a small
 * odometer when it arrives. On a pointer it lifts a little and the photo
 * leans in; under a thumb it gives.
 */
function GarageCard({
  vehicle,
  index,
  due,
  fill,
  onPress,
}: {
  vehicle: SavedVehicle;
  index: number;
  /** In a grid row: stretch to the row's height so neighbours end together. */
  fill?: boolean;
  /** The most pressing reminder, when one is overdue or coming up. */
  due?: { title: string; status: ReminderStatus };
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const lift = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;
  const reading = useRef(new Animated.Value(reduced ? vehicle.odometer ?? 0 : 0)).current;

  // The mileage rolls up from zero to the car's last reading, once, as the
  // card arrives behind its own entrance.
  useEffect(() => {
    if (vehicle.odometer === undefined) return;
    if (reduced) {
      reading.setValue(vehicle.odometer);
      return;
    }
    const animation = Animated.timing(reading, {
      toValue: vehicle.odometer,
      duration: Math.min(1700, 800 + vehicle.odometer / 180),
      delay: 420 + Math.min(index, 4) * 120,
      easing: ease.detent,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [vehicle.odometer, reduced, index, reading]);

  const to = (value: Animated.Value, target: number, ms: number = duration.slow) => {
    if (reduced) {
      value.setValue(target);
      return;
    }
    Animated.timing(value, { toValue: target, duration: ms, easing: ease.out, useNativeDriver: nativeDriver }).start();
  };

  return (
    <Animated.View
      style={{
        ...(fill ? { flex: 1 } : null),
        transform: [
          { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) },
          { scale: press },
        ],
      }}
    >
      <Pressable
        onPress={onPress}
        onHoverIn={() => to(lift, 1)}
        onHoverOut={() => to(lift, 0)}
        onPressIn={() => to(press, 0.985, 90)}
        onPressOut={() => to(press, 1, duration.base)}
        accessibilityRole="button"
        accessibilityLabel={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
        style={(state) => {
          const { focused } = state as PressState;
          return [styles.card, fill && styles.cardFill, focused && focusRing];
        }}
      >
        {vehicle.cover ? (
          <Animated.View style={{ transform: [{ scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] }) }] }}>
            <PhotoImage
              thumbUrl={vehicle.cover.thumbUrl}
              url={vehicle.cover.url}
              style={styles.cover}
              resizeMode="cover"
              accessibilityLabel={`Photo of the ${vehicle.year} ${vehicle.make} ${vehicle.model}`}
            />
          </Animated.View>
        ) : fill ? (
          // No photo, in a grid row beside one that has: the make's initial on paper,
          // so the card keeps the shape of its neighbours.
          <View style={styles.noPhoto} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text style={styles.noPhotoInitial}>{vehicle.make.charAt(0)}</Text>
          </View>
        ) : null}
        <View style={[styles.cardBody, fill && styles.cardBodyFill]}>
          <Guilloche opacity={0.32} />
          <View style={styles.cardTop}>
            <Text style={styles.cardMake}>
              {vehicle.year} {vehicle.make}
            </Text>
            <Text style={styles.cardSince}>Since {formatMonthYear(vehicle.addedAt)}</Text>
          </View>
          <Text style={styles.cardModel}>{vehicle.model}</Text>
          {vehicle.trim ? <Text style={styles.cardTrim}>{vehicle.trim}</Text> : null}
          <View style={[styles.cardFoot, fill && styles.cardFootFill]}>
            <Text style={styles.cardVin}>{groupVin(vehicle.vin)}</Text>
            {vehicle.odometer !== undefined ? (
              <View style={styles.reading} accessible accessibilityLabel={`${vehicle.odometer.toLocaleString()} miles`}>
                <Odometer reading={reading} drums={6} size={14} />
                <Text style={styles.readingUnit}>mi</Text>
              </View>
            ) : null}
          </View>
        </View>
        {due ? (
          <View style={[styles.due, due.status.state === 'overdue' && styles.dueOverdue]}>
            <Text style={[styles.dueText, due.status.state === 'overdue' && styles.dueTextOverdue]}>
              {due.title}: {due.status.text.charAt(0).toLowerCase() + due.status.text.slice(1)}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 20, flexGrow: 1, ...column },

  listWide: { maxWidth: 1120, paddingHorizontal: 48, paddingTop: 48, paddingBottom: 56 },
  gridRow: { gap: 24 },
  cell: { flex: 1, maxWidth: '50%' },
  titleWide: { fontSize: 72, lineHeight: 68 },
  count: { ...type.lead, color: colors.textMuted, marginTop: 8 },
  header: { paddingTop: 8 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  wordmark: {
    fontFamily: fonts.displayBold,
    fontSize: 26,
    color: colors.accent,
    letterSpacing: 0.5,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 16,
  },
  title: { ...type.hero, color: colors.text },

  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.page,
    overflow: 'hidden',
  },
  cardFill: { flex: 1 },
  noPhoto: { width: '100%', aspectRatio: 16 / 10, backgroundColor: colors.paperShade, alignItems: 'center', justifyContent: 'center' },
  noPhotoInitial: { fontFamily: fonts.displayBold, fontSize: 120, lineHeight: 120, color: colors.paperLine },
  cardBodyFill: { flex: 1 },
  cover: { width: '100%', aspectRatio: 16 / 10, backgroundColor: colors.paperShade },
  cardBody: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 16 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardMake: { fontFamily: fonts.bodySemi, fontSize: type.compact.fontSize, color: colors.inkMuted },
  cardSince: { ...type.caption, color: colors.inkMuted },
  cardModel: { ...type.display, fontSize: 32, lineHeight: 34, color: colors.ink, marginTop: 2 },
  cardTrim: { ...type.small, color: colors.inkMuted },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginTop: 14 },
  cardFootFill: { marginTop: 'auto', paddingTop: 14 },
  cardVin: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.inkMuted,
    letterSpacing: 0.5,
    paddingBottom: 1,
  },
  reading: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  readingUnit: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 16, color: colors.inkMuted },

  // A tag along the card's foot, like a service sticker on a windshield.
  due: { backgroundColor: colors.paperShade, paddingHorizontal: 18, paddingVertical: 10 },
  dueOverdue: { backgroundColor: colors.stampWash },
  dueText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
  dueTextOverdue: { color: colors.stampInk },

  skeletons: { gap: 20, marginTop: 8 },
  skeletonsWide: { flexDirection: 'row', gap: 24 },
  skeletonCell: { flex: 1 },
  bay: { marginTop: 4 },
  empty: { paddingTop: 28, maxWidth: 460 },
  emptyTitle: { ...type.hero, fontSize: 44, lineHeight: 44, color: colors.text, marginTop: 20 },
  emptyBody: { ...type.lead, color: colors.textMuted, marginTop: 16 },
  emptyHint: { ...type.small, color: colors.textFaint, marginTop: 20, maxWidth: 400 },

  emptyButton: { marginTop: 28, alignSelf: 'flex-start' },
});
