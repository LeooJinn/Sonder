import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { loadPassport, type Passport } from '../../lib/passport';
import { regionLabel } from '../../lib/regions';
import { SpecList } from '../../components/SpecList';
import { EntryCard } from '../../components/EntryCard';
import { colors } from '../../lib/theme';

/**
 * A published passport. Route: /p/:vin
 *
 * The only screen in the app a signed-out visitor can reach — the auth guard
 * in the root layout lets the "p" segment through.
 */
export default function PublicPassportScreen() {
  const { vin } = useLocalSearchParams<{ vin: string }>();
  const [passport, setPassport] = useState<Passport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPassport(vin)
      .then(setPassport)
      .catch(() => setPassport(null))
      .finally(() => setLoading(false));
  }, [vin]);

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Stack.Screen options={{ title: 'Passport' }} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!passport) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text style={styles.missingTitle}>No public passport here</Text>
        <Text style={styles.missingBody}>
          This car either isn&apos;t on Sonder, or its owner hasn&apos;t published it.
        </Text>
      </View>
    );
  }

  const { vehicle, entries, owner } = passport;
  const ownerName = owner.displayName ?? (owner.handle ? `@${owner.handle}` : 'A Sonder owner');
  const region = regionLabel(owner.region);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: `${vehicle.year} ${vehicle.make}` }} />

      <Text style={styles.wordmark}>SONDER</Text>

      <Text style={styles.title}>
        {vehicle.year} {vehicle.make} {vehicle.model}
      </Text>
      {vehicle.trim ? <Text style={styles.trim}>{vehicle.trim}</Text> : null}

      <Text style={styles.owner}>
        Kept by {ownerName}
        {region ? ` · ${region}` : ''}
      </Text>

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
          <Text style={styles.emptyText}>Nothing logged on this passport yet.</Text>
        </View>
      ) : (
        <View style={styles.entries}>
          {entries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </View>
      )}

      <Text style={styles.footer}>Every car has a life of its own.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 32, gap: 8 },
  content: { padding: 20, paddingBottom: 48 },

  wordmark: {
    color: colors.textFaint,
    fontSize: 12,
    letterSpacing: 4,
    fontWeight: '700',
    marginBottom: 24,
  },

  title: { color: colors.text, fontSize: 26, fontWeight: '700' },
  trim: { color: colors.textMuted, fontSize: 16, marginTop: 2 },
  owner: { color: colors.textFaint, fontSize: 14, marginTop: 10 },

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
  emptyText: { color: colors.textFaint, fontSize: 14 },

  entries: { gap: 10 },

  footer: {
    color: colors.textFaint,
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 36,
  },

  missingTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  missingBody: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
