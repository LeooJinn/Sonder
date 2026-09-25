import { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadGarage, type SavedVehicle } from '../../lib/garage';
import { useAuth } from '../../lib/auth';
import { describeError } from '../../lib/errors';
import { loadGarageReminders, type ReminderStatus } from '../../lib/reminders';
import { formatMonthYear } from '../../lib/dates';
import { groupVin } from '../../components/DataPage';
import { Button, ErrorState, focusRing, type PressState } from '../../components/ui';
import { colors, column, fonts, radius, type } from '../../lib/theme';

export default function GarageScreen() {
  const [garage, setGarage] = useState<SavedVehicle[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [due, setDue] = useState<Map<string, { title: string; status: ReminderStatus }>>(new Map());
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

      <FlatList
        data={garage}
        keyExtractor={(vehicle) => vehicle.vin}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.topBar}>
              <Text style={styles.wordmark}>Sonder</Text>
              <Button label="Profile" variant="quiet" onPress={() => router.push('/profile')} />
            </View>
            {loaded && !isEmpty ? (
              <View style={styles.titleRow}>
                <Text style={styles.title} accessibilityRole="header">
                  Garage
                </Text>
                <Button label="Add a car" variant="quiet" onPress={() => router.push('/add')} />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <GarageCard
            vehicle={item}
            due={due.get(item.vin)}
            onPress={() => router.push(`/vehicle/${item.vin}`)}
          />
        )}
        // Only show the empty state once we've actually checked, otherwise it
        // flashes for a moment on every launch.
        ListEmptyComponent={
          isEmpty ? (
            <View style={styles.empty}>
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
              <Button label="Add a car" onPress={() => router.push('/add')} style={styles.emptyButton} />
            </View>
          ) : null
        }
      />
    </View>
  );
}

/**
 * A car in the garage. The photo carries it; the strip underneath is set in
 * the same type as its data page, so the two read as one object.
 */
function GarageCard({
  vehicle,
  due,
  onPress,
}: {
  vehicle: SavedVehicle;
  /** The most pressing reminder, when one is overdue or coming up. */
  due?: { title: string; status: ReminderStatus };
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
      style={(state) => {
        const { pressed, focused } = state as PressState;
        return [styles.card, pressed && styles.cardPressed, focused && focusRing];
      }}
    >
      {vehicle.cover ? (
        <Image source={{ uri: vehicle.cover.url }} style={styles.cover} resizeMode="cover" />
      ) : null}
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.cardMake}>
            {vehicle.year} {vehicle.make}
          </Text>
          <Text style={styles.cardSince}>Since {formatMonthYear(vehicle.addedAt)}</Text>
        </View>
        <Text style={styles.cardModel}>{vehicle.model}</Text>
        {vehicle.trim ? <Text style={styles.cardTrim}>{vehicle.trim}</Text> : null}
        <Text style={styles.cardVin}>{groupVin(vehicle.vin)}</Text>
      </View>
      {due ? (
        <View style={[styles.due, due.status.state === 'overdue' && styles.dueOverdue]}>
          <Text style={[styles.dueText, due.status.state === 'overdue' && styles.dueTextOverdue]}>
            {due.title}: {due.status.text.charAt(0).toLowerCase() + due.status.text.slice(1)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 20, flexGrow: 1, ...column },

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
  cardPressed: { opacity: 0.85 },
  cover: { width: '100%', aspectRatio: 16 / 10, backgroundColor: colors.paperShade },
  cardBody: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 16 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardMake: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.inkMuted },
  cardSince: { ...type.caption, color: colors.inkMuted },
  cardModel: { ...type.display, fontSize: 32, lineHeight: 34, color: colors.ink, marginTop: 2 },
  cardTrim: { ...type.small, color: colors.inkMuted },
  cardVin: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.inkMuted,
    letterSpacing: 0.5,
    marginTop: 12,
  },

  // A tag along the card's foot, like a service sticker on a windshield.
  due: { backgroundColor: colors.paperShade, paddingHorizontal: 18, paddingVertical: 10 },
  dueOverdue: { backgroundColor: '#F4D9D5' },
  dueText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
  dueTextOverdue: { color: '#8E2A24' },

  empty: { paddingTop: 40, maxWidth: 460 },
  emptyTitle: { ...type.hero, fontSize: 44, lineHeight: 44, color: colors.text },
  emptyBody: { ...type.lead, color: colors.textMuted, marginTop: 16 },
  emptyHint: {
    ...type.small,
    color: colors.textFaint,
    marginTop: 24,
    paddingLeft: 14,
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
  },

  emptyButton: { marginTop: 28, alignSelf: 'flex-start' },
});
