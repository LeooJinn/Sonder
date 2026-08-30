import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { findVehicle, removeVehicle, type SavedVehicle } from '../../../lib/garage';
import { loadEntries, removeEntriesForVehicle, type LogEntry } from '../../../lib/log';
import { SpecList } from '../../../components/SpecList';
import { EntryCard } from '../../../components/EntryCard';
import { colors } from '../../../lib/theme';

/**
 * The square brackets in the folder name make this a dynamic route:
 * /vehicle/1FMCU0G65LUA35573 lands here with vin set to that string.
 */
export default function VehicleScreen() {
  const { vin } = useLocalSearchParams<{ vin: string }>();
  const [vehicle, setVehicle] = useState<SavedVehicle | null>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const router = useRouter();

  // Reloads on every focus so an entry added on the next screen shows up
  // when you come back — same reason the garage list uses this.
  useFocusEffect(
    useCallback(() => {
      Promise.all([findVehicle(vin), loadEntries(vin)]).then(([found, log]) => {
        setVehicle(found);
        setEntries(log);
        setLoaded(true);
      });
    }, [vin])
  );

  async function handleRemove() {
    if (!confirmingRemove) {
      setConfirmingRemove(true);
      return;
    }
    // Delete the log too. Otherwise removing a car leaves its history
    // orphaned in storage with nothing pointing at it.
    await removeEntriesForVehicle(vin);
    await removeVehicle(vin);
    router.replace('/');
  }

  if (!loaded) return <View style={styles.screen} />;

  if (!vehicle) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text style={styles.missing}>That vehicle isn&apos;t in your garage.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: `${vehicle.year} ${vehicle.make}` }} />

      <Text style={styles.title}>
        {vehicle.year} {vehicle.make} {vehicle.model}
      </Text>
      {vehicle.trim ? <Text style={styles.trim}>{vehicle.trim}</Text> : null}

      <View style={styles.plate}>
        <SpecList vehicle={vehicle} />
      </View>

      <View style={styles.logHeader}>
        <Text style={styles.logTitle}>Build log</Text>
        <Text style={styles.logCount}>
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </Text>
      </View>

      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Nothing logged yet. Mods, service, repairs and milestones go here.
          </Text>
        </View>
      ) : (
        <View style={styles.entries}>
          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onPress={() => router.push(`/vehicle/${vin}/entry/${entry.id}`)}
            />
          ))}
        </View>
      )}

      <Pressable
        style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
        onPress={() => router.push(`/vehicle/${vin}/add`)}
      >
        <Text style={styles.addButtonText}>Add to log</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
        onPress={handleRemove}
      >
        <Text style={styles.removeText}>
          {confirmingRemove ? 'Tap again to remove vehicle and log' : 'Remove from garage'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },

  title: { color: colors.text, fontSize: 26, fontWeight: '700' },
  trim: { color: colors.textMuted, fontSize: 16, marginTop: 2 },

  plate: {
    marginTop: 24,
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    padding: 20,
  },

  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 32,
    marginBottom: 12,
  },
  logTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  logCount: { color: colors.textFaint, fontSize: 13 },

  empty: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 6,
    padding: 20,
  },
  emptyText: { color: colors.textFaint, fontSize: 14, lineHeight: 20 },

  entries: { gap: 10 },

  addButton: {
    backgroundColor: colors.accent,
    borderRadius: 4,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  addButtonPressed: { opacity: 0.8 },
  addButtonText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },

  remove: { marginTop: 24, paddingVertical: 12, alignItems: 'center' },
  removePressed: { opacity: 0.6 },
  removeText: { color: colors.accent, fontSize: 14, fontWeight: '600' },

  missing: { color: colors.textMuted, fontSize: 15, padding: 20 },
});
