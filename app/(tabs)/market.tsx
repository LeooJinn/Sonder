import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
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
import { CarDrawing } from '../../components/CarDrawing';
import { CoverTexture } from '../../components/CoverTexture';
import { Guilloche } from '../../components/Guilloche';
import { LiftPressable } from '../../components/LiftPressable';
import { Reveal } from '../../components/Reveal';
import { SkeletonCard } from '../../components/Skeleton';
import { Button, ErrorState, focusRing, type PressState } from '../../components/ui';
import { colors, fonts, radius, type } from '../../lib/theme';

/** The width at which the side rail appears and the screen becomes a grid. */
const WIDE = 900;
const GAP = 24;

/**
 * Cars for sale. Every one of them is a published passport, so a buyer can
 * read the car's whole history before sending a single message — which is the
 * only reason to list a car here rather than anywhere else.
 *
 * On a phone it is one column of listings. On a wide screen the newest car is
 * set as a feature across the top and the rest fall into a grid, each with its
 * price pinned to the photo like a tag on a windscreen.
 */
export default function MarketScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const [region, setRegion, regionReady] = useHomeRegion();
  const [listings, setListings] = useState<MarketListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gridWidth, setGridWidth] = useState(0);

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

  // Two columns, or three where there is room; one on a phone.
  const columns = !wide ? 1 : gridWidth >= 1000 ? 3 : 2;
  const cell = gridWidth > 0 ? Math.floor((gridWidth - GAP * (columns - 1)) / columns) : undefined;

  // The newest car leads, set sideways across the width; the rest are a grid.
  const featured = wide && listings && listings.length >= 1 ? listings[0] : null;
  const rest = featured && listings ? listings.slice(1) : listings ?? [];

  const open = (listing: MarketListing) => router.push(`/p/${listing.vehicle.vin}`);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <CoverTexture />
      <ScrollView contentContainerStyle={[styles.list, wide && styles.listWide]}>
        <Reveal rise={8} style={styles.header}>
          <View style={wide ? styles.headerRow : undefined}>
            <View style={styles.headerText}>
              <Text style={[styles.title, wide && styles.titleWide]} accessibilityRole="header">
                For sale
              </Text>
              {wide && listings ? (
                <Text style={styles.count}>
                  {listings.length === 0
                    ? 'No cars listed'
                    : `${listings.length} ${listings.length === 1 ? 'car' : 'cars'}`}
                  {place ? ` in ${place}` : ''}
                </Text>
              ) : null}
              <Text style={styles.intro}>
                Every car here comes with its passport. Read what&apos;s been done to it before you
                ask a single question.
              </Text>
            </View>
            <View style={[styles.filter, wide && styles.filterWide]}>
              <RegionPicker
                value={region}
                onChange={setRegion}
                emptyLabel="Everywhere"
                placeholder="Everywhere"
                title="Show cars in"
              />
            </View>
          </View>
        </Reveal>

        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : listings === null ? (
          <View
            style={[styles.grid, wide && styles.gridWide]}
            onLayout={(e: LayoutChangeEvent) => setGridWidth(e.nativeEvent.layout.width)}
          >
            {Array.from({ length: wide ? columns * 2 : 2 }, (_, i) => (
              <View key={i} style={cell ? { width: cell } : styles.fullCell}>
                <SkeletonCard />
              </View>
            ))}
          </View>
        ) : listings.length === 0 ? (
          <Empty place={place} wide={wide} onGarage={() => router.push('/')} />
        ) : (
          <View onLayout={(e: LayoutChangeEvent) => setGridWidth(e.nativeEvent.layout.width)}>
            {featured ? (
              <Reveal index={0} style={styles.feature}>
                <ListingCard listing={featured} feature onPress={() => open(featured)} />
              </Reveal>
            ) : null}
            <View style={[styles.grid, wide && styles.gridWide]}>
              {rest.map((listing, i) => (
                <Reveal
                  key={listing.vehicle.vin}
                  index={i + (featured ? 1 : 0)}
                  style={cell ? { width: cell } : styles.fullCell}
                >
                  <ListingCard listing={listing} onPress={() => open(listing)} />
                </Reveal>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * The feature card's model name is set big, but a long one ("AMG GT Black
 * Series Coupe...") would run to a dozen lines in the narrow column beside the
 * photo, so it steps down with the length of the name.
 */
function featureModelSize(model: string) {
  if (model.length <= 12) return styles.cardModelFeature;
  if (model.length <= 26) return styles.cardModelFeatureMid;
  return styles.cardModelFeatureLong;
}

/** The asking price, printed as a tag: paper, ink, square-cornered. */
function PriceTag({ listing, large }: { listing: MarketListing; large?: boolean }) {
  const text = listing.askingPriceCents !== undefined ? formatCents(listing.askingPriceCents) : 'Offers';
  // The big price shrinks as it gets longer, so "$127,000.50" never runs off the card.
  const size = text.length <= 7 ? 64 : text.length <= 9 ? 52 : 40;
  return (
    <View style={[styles.tag, large && styles.tagLarge]}>
      <Text
        style={[styles.price, large && { fontSize: size, lineHeight: size }]}
        numberOfLines={1}
      >
        {text}
      </Text>
    </View>
  );
}

function ListingCard({
  listing,
  feature,
  onPress,
}: {
  listing: MarketListing;
  /** The newest car, laid out sideways across the whole grid. */
  feature?: boolean;
  onPress: () => void;
}) {
  const { vehicle } = listing;
  const place = regionLabel(listing.region);
  const name = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

  const photo = listing.photoUrl ? (
    <PhotoImage
      thumbUrl={listing.photoThumbUrl}
      url={listing.photoUrl}
      style={feature ? styles.featurePhoto : styles.photo}
      resizeMode="cover"
      accessibilityLabel={`Photo of the ${name}`}
    />
  ) : (
    // No photo: the make's initial on paper, like the monogram on a document.
    <View style={[feature ? styles.featurePhoto : styles.photo, styles.photoBlank]}>
      <Text style={styles.initial}>{vehicle.make.charAt(0) || '?'}</Text>
    </View>
  );

  return (
    <LiftPressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${name}, ${
        listing.askingPriceCents !== undefined ? formatCents(listing.askingPriceCents) : 'make an offer'
      }`}
      style={(state) => {
        const { pressed, focused } = state as PressState;
        return [styles.card, feature && styles.cardFeature, pressed && styles.cardPressed, focused && focusRing];
      }}
    >
      <View style={feature ? styles.featureMedia : undefined}>
        {photo}
        {feature ? null : (
          <View style={styles.tagPin}>
            <PriceTag listing={listing} />
          </View>
        )}
      </View>
      <View style={feature ? styles.featureBody : undefined}>
        <View style={styles.cardBody}>
          <Guilloche opacity={0.3} />
          <View style={[styles.cardMain, !feature && styles.cardMainGrid]}>
            <Text style={styles.cardMake} numberOfLines={1}>
              {vehicle.year} {vehicle.make}
            </Text>
            <Text
              style={[styles.cardModel, feature && featureModelSize(vehicle.model)]}
              numberOfLines={feature ? 4 : 2}
            >
              {vehicle.model}
            </Text>
            {vehicle.trim ? (
              <Text style={styles.cardTrim} numberOfLines={1}>
                {vehicle.trim}
              </Text>
            ) : null}
          </View>
          {feature ? <PriceTag listing={listing} large /> : null}
        </View>
        <Text style={styles.cardMeta}>
          {place ? `${place}. ` : ''}Listed {formatAgo(listing.listedAt)}.
        </Text>
      </View>
    </LiftPressable>
  );
}

/**
 * Nothing listed. Instead of a dead end this says how a car gets here, in the
 * three steps it takes, on a paper page like the rest of the car's papers.
 */
function Empty({ place, wide, onGarage }: { place?: string; wide: boolean; onGarage: () => void }) {
  const steps = [
    ['Open the car in your garage', 'Any car you keep on Sonder can be listed.'],
    ['Turn on its public link', 'Buyers read the log from that link, no account needed.'],
    ['Mark it for sale', 'Add a price, or take offers. It appears here with its history attached.'],
  ];
  return (
    <View style={[styles.empty, wide && styles.emptyWide]}>
      <View style={styles.emptyText}>
        <Reveal rise={0}>
          <CarDrawing width={wide ? 320 : 260} />
        </Reveal>
        <Text style={styles.emptyTitle} accessibilityRole="header">
          {place ? `Nothing for sale in ${place} yet` : 'Nothing for sale yet'}
        </Text>
        <Text style={styles.emptyBody}>
          Selling yours? It shows up here with its history attached, so the right buyer can see
          what it is before they ask.
        </Text>
        <Button label="Open your garage" variant="quiet" onPress={onGarage} />
      </View>
      <View style={styles.steps}>
        <Guilloche opacity={0.34} />
        {steps.map(([title, body], i) => (
          <View key={title} style={[styles.step, i > 0 && styles.stepRule]}>
            <Text style={styles.stepNumber}>{i + 1}</Text>
            <View style={styles.stepText}>
              <Text style={styles.stepTitle}>{title}</Text>
              <Text style={styles.stepBody}>{body}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: 20, paddingBottom: 32, flexGrow: 1, width: '100%', maxWidth: 640, alignSelf: 'center' },
  listWide: { maxWidth: 1120, paddingHorizontal: 48, paddingTop: 48, paddingBottom: 64 },

  header: { paddingTop: 20, marginBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 32 },
  headerText: { flex: 1 },
  title: { ...type.hero, color: colors.text },
  titleWide: { fontSize: 72, lineHeight: 68 },
  count: { ...type.lead, color: colors.textMuted, marginTop: 8 },
  intro: { ...type.body, color: colors.textMuted, marginTop: 10, maxWidth: 520 },
  filter: { marginTop: 20, marginBottom: 4 },
  filterWide: { marginTop: 0, marginBottom: 6, minWidth: 220 },

  grid: { gap: 20 },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  fullCell: { width: '100%' },
  feature: { marginBottom: GAP },

  card: { backgroundColor: colors.paper, borderRadius: radius.page, overflow: 'hidden' },
  cardFeature: { flexDirection: 'row' },
  cardPressed: { opacity: 0.85 },
  photo: { width: '100%', aspectRatio: 16 / 10, backgroundColor: colors.paperShade },
  photoBlank: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.displayBold, fontSize: 72, color: colors.inkMuted },
  featureMedia: { width: '58%' },
  featurePhoto: { width: '100%', height: '100%', minHeight: 340, backgroundColor: colors.paperShade },
  featureBody: { flex: 1, minWidth: 0, justifyContent: 'space-between' },

  // The price tag: pinned to the photo's corner, square like a hang-tag.
  tagPin: { position: 'absolute', left: 14, bottom: 14 },
  tag: { backgroundColor: colors.paper, borderRadius: radius.tag, paddingVertical: 5, paddingHorizontal: 12 },
  tagLarge: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 0, backgroundColor: 'transparent' },
  price: { fontFamily: fonts.displayBold, fontSize: 28, lineHeight: 32, color: colors.ink, fontVariant: ['tabular-nums'] },

  cardBody: { paddingHorizontal: 18, paddingTop: 14, overflow: 'hidden' },
  cardMain: { flex: 1 },
  cardMake: { fontFamily: fonts.bodySemi, fontSize: type.compact.fontSize, color: colors.inkMuted },
  cardModel: { ...type.display, fontSize: 30, lineHeight: 32, color: colors.ink, marginTop: 2 },
  cardModelFeature: { fontSize: 56, lineHeight: 54, marginTop: 4 },
  cardModelFeatureMid: { fontSize: 44, lineHeight: 44, marginTop: 4 },
  cardModelFeatureLong: { fontSize: 34, lineHeight: 36, marginTop: 4 },
  // Room for a two-line name, so cards in a row come out the same height.
  cardMainGrid: { minHeight: 112 },
  cardTrim: { ...type.small, color: colors.inkMuted },
  cardMeta: {
    ...type.caption,
    color: colors.inkMuted,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 16,
  },

  empty: { paddingTop: 16, gap: 32 },
  emptyWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 56, paddingTop: 24 },
  emptyText: { flex: 1, gap: 4, alignItems: 'flex-start' },
  emptyTitle: { ...type.title, color: colors.text, marginTop: 20 },
  emptyBody: { ...type.body, color: colors.textMuted, marginTop: 10, marginBottom: 12, maxWidth: 460 },
  steps: {
    flex: 1,
    backgroundColor: colors.paper,
    borderRadius: radius.page,
    paddingHorizontal: 22,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  step: { flexDirection: 'row', gap: 18, paddingVertical: 18, alignItems: 'flex-start' },
  stepRule: { borderTopWidth: 1, borderTopColor: colors.paperLine },
  stepNumber: { fontFamily: fonts.displayBold, fontSize: 44, lineHeight: 44, color: colors.inkMuted, width: 32 },
  stepText: { flex: 1 },
  stepTitle: { ...type.item, color: colors.ink },
  stepBody: { ...type.small, color: colors.inkMuted, marginTop: 4 },
});
