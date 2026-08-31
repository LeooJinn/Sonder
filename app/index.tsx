import { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { loadGarage, type SavedVehicle } from '../lib/garage';
import { colors, column, mono } from '../lib/theme';

export default function GarageScreen() {
  const [garage, setGarage] = useState<SavedVehicle[]>([]);
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();

  /**
   * useFocusEffect runs every time this screen comes into view — including
   * when you navigate *back* to it. A plain useEffect would only run once,
   * so a car added on another screen wouldn't show up until a restart.
   *
   * useCallback stops the effect re-running on every render.
   */
  useFocusEffect(
    useCallback(() => {
      loadGarage().then((vehicles) => {
        setGarage(vehicles);
        setLoaded(true);
      });
    }, [])
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: 'Garage',
          headerRight: () => (
            <Pressable onPress={() => router.push('/profile')} hitSlop={8}>
              <Text style={styles.signOut}>Profile</Text>
            </Pressable>
          ),
        }}
      />

      <FlatList
        data={garage}
        keyExtractor={(vehicle) => vehicle.vin}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => router.push(`/vehicle/${item.vin}`)}
          >
            {item.cover ? (
              <Image
                source={{ uri: item.cover.url }}
                style={[styles.cover, { aspectRatio: item.cover.aspectRatio }]}
                resizeMode="cover"
              />
            ) : null}
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>
                {item.year} {item.make} {item.model}
              </Text>
              {item.trim ? <Text style={styles.cardTrim}>{item.trim}</Text> : null}
              <Text style={styles.cardVin}>{item.vin}</Text>
            </View>
          </Pressable>
        )}
        // Only show the empty state once we've actually checked storage,
        // otherwise it flashes for a moment on every launch.
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No vehicles yet</Text>
              <Text style={styles.emptyBody}>
                Add a car by its VIN and it stays in your garage.
              </Text>
            </View>
          ) : null
        }
      />

      <Pressable
        style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
        onPress={() => router.push('/add')}
      >
        <Text style={styles.addButtonText}>Add a vehicle</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { padding: 20, gap: 12, flexGrow: 1, ...column },

  signOut: { color: colors.accent, fontSize: 14, fontWeight: '600' },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    overflow: 'hidden',
  },
  cardPressed: { opacity: 0.7 },
  // aspectRatio comes from the photo itself; maxHeight stops a tall portrait
  // shot from pushing the rest of the garage off screen. Within that box the
  // image crops rather than distorts.
  cover: { width: '100%', maxHeight: 260, backgroundColor: colors.background },
  cardBody: { padding: 16 },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  cardTrim: { color: colors.textMuted, fontSize: 14, marginTop: 1 },
  cardVin: {
    color: colors.textFaint,
    fontSize: 12,
    fontFamily: mono,
    letterSpacing: 1,
    marginTop: 8,
  },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 6 },
  emptyTitle: { color: colors.textMuted, fontSize: 17, fontWeight: '600' },
  emptyBody: { color: colors.textFaint, fontSize: 14, textAlign: 'center' },

  addButton: {
    backgroundColor: colors.accent,
    borderRadius: 4,
    paddingVertical: 15,
    alignItems: 'center',
    margin: 20,
    marginTop: 0,
  },
  addButtonPressed: { opacity: 0.8 },
  addButtonText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
