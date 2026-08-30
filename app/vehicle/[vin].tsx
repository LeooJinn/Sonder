import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { findVehicle, removeVehicle, type SavedVehicle } from '../../lib/garage';
import { SpecList } from '../../components/SpecList';
import { colors } from '../../lib/theme';

/**
 * The square brackets in the filename make this a dynamic route:
 * /vehicle/1FMCU0G65LUA35573 lands here with vin set to that string.
 */
export default function VehicleScreen() {
  const { vin } = useLocalSearchParams<{ vin: string }>();
  const [vehicle, setVehicle] = useState<SavedVehicle | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const router = useRouter();

  // Runs once when the screen mounts, and again if the vin ever changes.
  useEffect(() => {
    findVehicle(vin).then((found) => {
      setVehicle(found);
      setLoaded(true);
    });
  }, [vin]);

  async function handleRemove() {
    // First tap arms it, second tap does it. Simple, and it works on every
    // platform — React Native's Alert is a no-op on web.
    if (!confirmingRemove) {
      setConfirmingRemove(true);
      return;
    }
    await removeVehicle(vin);
    router.replace('/');
  }

  if (!loaded) {
    return <View style={styles.screen} />;
  }

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

      <View style={styles.logPlaceholder}>
        <Text style={styles.logTitle}>Build log</Text>
        <Text style={styles.logBody}>
          Mods, service and repairs will live here. Coming next.
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
        onPress={handleRemove}
      >
        <Text style={styles.removeText}>
          {confirmingRemove ? 'Tap again to remove' : 'Remove from garage'}
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

  logPlaceholder: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 6,
    padding: 20,
    gap: 4,
  },
  logTitle: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  logBody: { color: colors.textFaint, fontSize: 14 },

  remove: { marginTop: 28, paddingVertical: 12, alignItems: 'center' },
  removePressed: { opacity: 0.6 },
  removeText: { color: colors.accent, fontSize: 14, fontWeight: '600' },

  missing: { color: colors.textMuted, fontSize: 15, padding: 20 },
});
