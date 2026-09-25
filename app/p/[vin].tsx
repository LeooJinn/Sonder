import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { loadPassport, type Passport } from '../../lib/passport';
import { regionLabel } from '../../lib/regions';
import { formatCents } from '../../lib/log';
import { formatAgo, ordinal } from '../../lib/dates';
import { describeError } from '../../lib/errors';
import { DataPage } from '../../components/DataPage';
import { Gallery } from '../../components/Gallery';
import { Timeline, ownerName, period, summarize } from '../../components/Timeline';
import { Button, ErrorState } from '../../components/ui';
import { ReportSheet } from '../../components/ReportSheet';
import { reportListing } from '../../lib/moderation';
import { useAuth } from '../../lib/auth';
import { colors, column, fonts, radius, type } from '../../lib/theme';

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
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { session } = useAuth();
  const [reporting, setReporting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    loadPassport(vin)
      .then(setPassport)
      .catch((e) => setError(describeError(e)))
      .finally(() => setLoading(false));
  }, [vin]);

  useEffect(load, [load]);

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Stack.Screen options={{ headerShown: false, title: 'Passport' }} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false, title: 'Passport' }} />
        <ErrorState message={error} onRetry={load} />
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

  const { vehicle, chapters, listing } = passport;
  const current = chapters[0];
  const keeper = ownerName(current.owner, 'Its owner');
  const region = regionLabel(current.owner?.region);

  // The car's own gallery first, then any photo from its history.
  const photo =
    current.gallery[0]?.url ??
    chapters.flatMap((c) => c.entries).find((e) => e.photos.length > 0)?.photos[0]?.url ??
    chapters.find((c) => c.gallery.length > 0)?.gallery[0]?.url;
  const gallery = chapters.flatMap((c) => c.gallery);

  const holder = [
    `Kept by ${keeper}${region ? ` in ${region}` : ''}.`,
    chapters.length > 1 ? `${ordinal(chapters.length)} owner on Sonder.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{ headerShown: false, title: `${vehicle.year} ${vehicle.make} ${vehicle.model}` }}
      />

      <View style={styles.topBar}>
        <Text style={styles.wordmark}>Sonder</Text>
        {/* Visitors arrive from a link and have nowhere to go back to; members
            arrive from For sale or their own car and do. */}
        {router.canGoBack() ? (
          <Button label="Back" variant="quiet" onPress={() => router.back()} />
        ) : (
          <Text style={styles.docType}>Vehicle passport</Text>
        )}
      </View>

      <DataPage vehicle={vehicle} photoUrl={photo} holder={holder} />

      {listing && (
        <View style={styles.listing}>
          <Text style={styles.listingLabel}>For sale</Text>
          <Text style={styles.price}>
            {listing.askingPriceCents !== undefined
              ? formatCents(listing.askingPriceCents)
              : 'Make an offer'}
          </Text>
          <Text style={styles.listingMeta}>
            Listed {formatAgo(listing.listedAt)}
            {region ? ` in ${region}` : ''}. Everything below is the car&apos;s logged history.
          </Text>
          {listing.contact ? (
            <View style={styles.contact}>
              <Text style={styles.contactLabel}>Contact the seller</Text>
              <Text style={styles.contactValue} selectable>
                {listing.contact}
              </Text>
            </View>
          ) : null}
          {/* Members can report a listing; visitors would need an account
              first, and the seller doesn't report their own car. */}
          {session && current.owner?.id !== session.user.id ? (
            <View style={styles.reportRow}>
              <Button label="Report this listing" variant="quiet" onPress={() => setReporting(true)} />
            </View>
          ) : null}
        </View>
      )}

      <ReportSheet
        visible={reporting}
        what="listing"
        onSubmit={(reason, note) => reportListing(current.ownershipId, reason, note)}
        onClose={() => setReporting(false)}
      />

      <View style={styles.section}>
        <Timeline
          chapters={chapters.map((chapter, i) => ({
            key: chapter.ownershipId,
            title:
              i === 0
                ? `${keeper}'s time with it`
                : `${ownerName(chapter.owner)}'s time with it`,
            subtitle: [period(chapter.startedOn, chapter.endedOn), summarize(chapter.entries)]
              .filter(Boolean)
              .join(' '),
            entries: chapter.entries,
            empty:
              i === 0
                ? 'Nothing has been logged on this passport yet.'
                : 'Nothing was logged in this time.',
          }))}
        />
      </View>

      {gallery.length > 0 && (
        <View style={styles.section}>
          <Gallery photos={gallery} />
        </View>
      )}

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

  listing: {
    marginTop: 16,
    padding: 20,
    borderRadius: radius.page,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  listingLabel: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.accent },
  price: { ...type.hero, color: colors.text, marginTop: 4 },
  listingMeta: { ...type.small, color: colors.textMuted, marginTop: 8 },
  contact: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  contactLabel: { ...type.caption, color: colors.textFaint },
  contactValue: { ...type.bodyStrong, color: colors.text, marginTop: 2 },
  reportRow: { marginTop: 16 },

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
