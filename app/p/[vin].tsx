import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { loadPassport, type Passport } from '../../lib/passport';
import { regionLabel } from '../../lib/regions';
import { formatCents } from '../../lib/log';
import { DataPage } from '../../components/DataPage';
import { Timeline } from '../../components/Timeline';
import { colors, column, fonts, type } from '../../lib/theme';

/**
 * A published passport. Route: /p/:vin
 *
 * The only screen in the app a signed-out visitor can reach — the auth guard
 * in the root layout lets the "p" segment through. Most people arrive here
 * from a link someone sent them, knowing nothing about Sonder, so the page
 * has to explain itself as well as the car.
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
        <Stack.Screen options={{ headerShown: false, title: 'Passport' }} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!passport) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Stack.Screen options={{ headerShown: false, title: 'Not found' }} />
        <Text style={styles.missingTitle}>No public passport at this link</Text>
        <Text style={styles.missingBody}>
          The car isn&apos;t on Sonder, or its owner has made its log private. Check the link
          with whoever sent it.
        </Text>
      </View>
    );
  }

  const { vehicle, entries, owner } = passport;
  const ownerName = owner.displayName ?? (owner.handle ? `@${owner.handle}` : 'Its owner');
  const region = regionLabel(owner.region);
  const spent = entries.reduce((total, e) => total + (e.costCents ?? 0), 0);
  const photo = entries.find((e) => e.photos.length > 0)?.photos[0]?.url;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{ headerShown: false, title: `${vehicle.year} ${vehicle.make} ${vehicle.model}` }}
      />

      <View style={styles.topBar}>
        <Text style={styles.wordmark}>Sonder</Text>
        <Text style={styles.docType}>Vehicle passport</Text>
      </View>

      <DataPage
        vehicle={vehicle}
        photoUrl={photo}
        holder={`Kept by ${ownerName}${region ? ` in ${region}` : ''}`}
      />

      <View style={styles.section}>
        <Timeline
          chapters={[
            {
              key: 'current',
              title: `${ownerName}'s time with it`,
              subtitle:
                entries.length === 0
                  ? ''
                  : `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}${
                      spent > 0 ? `, ${formatCents(spent)} logged` : ''
                    }.`,
              entries,
              empty: 'Nothing has been logged on this passport yet.',
            },
          ]}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerLine}>Every car has a life of its own.</Text>
        <Text style={styles.footerBody}>
          Sonder keeps a car&apos;s history with the car: every mod, service and repair, passed to
          the next owner when it sells.
        </Text>
        <Link href="/sign-in" style={styles.footerLink}>
          Start a passport for your car
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 32, gap: 10 },
  content: { padding: 16, paddingBottom: 56, ...column },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 4,
    paddingTop: 12,
    paddingBottom: 18,
  },
  wordmark: { fontFamily: fonts.displayBold, fontSize: 26, color: colors.accent },
  docType: { fontFamily: fonts.display, fontSize: 16, color: colors.textMuted },

  section: { marginTop: 36 },

  footer: {
    marginTop: 48,
    paddingTop: 28,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
    gap: 10,
  },
  footerLine: { ...type.heading, color: colors.text, textAlign: 'center' },
  footerBody: { ...type.small, color: colors.textMuted, textAlign: 'center', maxWidth: 380 },
  footerLink: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.accent, marginTop: 6 },

  missingTitle: { ...type.title, color: colors.text, textAlign: 'center' },
  missingBody: { ...type.body, color: colors.textMuted, textAlign: 'center', maxWidth: 400 },
});
