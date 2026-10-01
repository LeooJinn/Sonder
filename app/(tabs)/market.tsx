import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { PhotoImage } from '../../components/PhotoImage';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadMarket, type MarketListing } from '../../lib/market';
import { formatCents } from '../../lib/log';
import { formatAgo } from '../../lib/dates';
import { regionLabel } from '../../lib/regions';
import { describeError } from '../../lib/errors';
import { useHomeRegion } from '../../components/useHomeRegion';
import { RegionPicker } from '../../components/RegionPicker';
import { CoverTexture } from '../../components/CoverTexture';
import { Guilloche } from '../../components/Guilloche';
import { LiftPressable } from '../../components/LiftPressable';
import { Reveal } from '../../components/Reveal';
import { SkeletonCard } from '../../components/Skeleton';
import { ErrorState, focusRing, type PressState } from '../../components/ui';
import { colors, column, fonts, radius, type } from '../../lib/theme';

/**
 * Cars for sale. Every one of them is a published passport, so a buyer can
 * read the car's whole history before sending a single message — which is the
 * only reason to list a car here rather than anywhere else.
 */
export default function MarketScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [region, setRegion, regionReady] = useHomeRegion();
  const [listings, setListings] = useState<MarketListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!regionReady) return;
    setError(null);
    setListings(null);
    loadMarket(region || undefined)
      .then(setListings)
      .catch((e) => setError(describeError(e)));
  }, [region, regionReady]);

  useEffect(load, [load]);

  const place = regionLabel(region);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <CoverTexture />
      <FlatList
        data={listings ?? []}
        keyExtractor={(listing) => listing.vehicle.vin}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Reveal rise={8} style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              For sale
            </Text>
            <Text style={styles.intro}>
              Every car here comes with its passport. Read what&apos;s been done to it before you
              ask a single question.
            </Text>
            <View style={styles.filter}>
              <RegionPicker
                value={region}
                onChange={setRegion}
                emptyLabel="Everywhere"
                placeholder="Everywhere"
                title="Show cars in"
              />
            </View>
          </Reveal>
        }
        renderItem={({ item, index }) => (
          <Reveal index={index}>
            <ListingCard listing={item} onPress={() => router.push(`/p/${item.vehicle.vin}`)} />
          </Reveal>
        )}
        ListEmptyComponent={
          error ? (
            <ErrorState message={error} onRetry={load} />
          ) : listings === null ? (
            <View style={styles.loading}>
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {place ? `Nothing for sale in ${place} yet` : 'Nothing for sale yet'}
              </Text>
              <Text style={styles.emptyBody}>
                Selling yours? Open it in your garage, turn on its public link, then mark it for
                sale. It shows up here with its history attached.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

function ListingCard({ listing, onPress }: { listing: MarketListing; onPress: () => void }) {
  const { vehicle } = listing;
  const place = regionLabel(listing.region);

  return (
    <LiftPressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${vehicle.year} ${vehicle.make} ${vehicle.model}, ${
        listing.askingPriceCents !== undefined ? formatCents(listing.askingPriceCents) : 'make an offer'
      }`}
      style={(state) => {
        const { pressed, focused } = state as PressState;
        return [styles.card, pressed && styles.cardPressed, focused && focusRing];
      }}
    >
      {listing.photoUrl ? (
        <PhotoImage
          thumbUrl={listing.photoThumbUrl}
          url={listing.photoUrl}
          style={styles.photo}
          resizeMode="cover"
          accessibilityLabel={`Photo of the ${vehicle.year} ${vehicle.make} ${vehicle.model}`}
        />
      ) : null}
      <View style={styles.cardBody}>
        <Guilloche opacity={0.3} />
        <View style={styles.cardMain}>
          <Text style={styles.cardMake}>
            {vehicle.year} {vehicle.make}
          </Text>
          <Text style={styles.cardModel}>{vehicle.model}</Text>
          {vehicle.trim ? <Text style={styles.cardTrim}>{vehicle.trim}</Text> : null}
        </View>
        <Text style={styles.price}>
          {listing.askingPriceCents !== undefined ? formatCents(listing.askingPriceCents) : 'Offers'}
        </Text>
      </View>
      <Text style={styles.cardMeta}>
        {place ? `${place}. ` : ''}Listed {formatAgo(listing.listedAt)}.
      </Text>
    </LiftPressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: 20, paddingBottom: 32, gap: 20, flexGrow: 1, ...column },

  header: { paddingTop: 20 },
  title: { ...type.hero, color: colors.text },
  intro: { ...type.body, color: colors.textMuted, marginTop: 10, maxWidth: 520 },
  filter: { marginTop: 20, marginBottom: 4 },

  loading: { gap: 20, marginTop: 8 },

  card: { backgroundColor: colors.paper, borderRadius: radius.page, overflow: 'hidden' },
  cardPressed: { opacity: 0.85 },
  photo: { width: '100%', aspectRatio: 16 / 10, backgroundColor: colors.paperShade },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  cardMain: { flex: 1 },
  cardMake: { fontFamily: fonts.bodySemi, fontSize: type.compact.fontSize, color: colors.inkMuted },
  cardModel: { ...type.display, fontSize: 30, lineHeight: 32, color: colors.ink, marginTop: 2 },
  cardTrim: { ...type.small, color: colors.inkMuted },
  price: { fontFamily: fonts.displayBold, fontSize: 28, lineHeight: 32, color: colors.ink },
  cardMeta: {
    ...type.caption,
    color: colors.inkMuted,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 16,
  },

  empty: { paddingTop: 32, maxWidth: 460 },
  emptyTitle: { ...type.title, color: colors.text },
  emptyBody: { ...type.body, color: colors.textMuted, marginTop: 10 },
});
