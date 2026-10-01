import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { MessageCar } from '../lib/messages';
import { colors, fonts, radius, type } from '../lib/theme';
import { LiftPressable } from './LiftPressable';
import { PhotoImage } from './PhotoImage';
import { focusRing, type PressState } from './ui';

/**
 * A car sent in a message. It's a link to the car's published passport, and
 * it's about one specific car, so it's printed on paper in ink like every
 * other page of a car's papers, a small one clipped to the bubble's width.
 *
 * A car that has stopped being public can't be read any more, so its card
 * says so rather than disappearing: the message still said "this car".
 */
export function MessageCarCard({ car }: { car?: MessageCar }) {
  const router = useRouter();

  if (!car) {
    return (
      <View style={[styles.card, styles.gone]}>
        <View style={styles.body}>
          <Text style={styles.goneTitle}>A car that is no longer public</Text>
          <Text style={styles.caption}>Its owner has made its passport private again.</Text>
        </View>
      </View>
    );
  }

  const { vehicle } = car;
  const name = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');

  return (
    <LiftPressable
      lift={3}
      onPress={() => router.push(`/p/${vehicle.vin}`)}
      accessibilityRole="link"
      accessibilityLabel={`${name}. Opens its passport.`}
      style={(state) => {
        const { pressed, focused } = state as PressState;
        return [styles.card, pressed && styles.pressed, focused && focusRing];
      }}
    >
      {car.photoUrl ? (
        <PhotoImage
          url={car.photoUrl}
          thumbUrl={car.photoThumbUrl}
          style={styles.photo}
          resizeMode="cover"
          accessibilityLabel=""
        />
      ) : null}
      <View style={styles.body}>
        <Text style={styles.make} numberOfLines={1}>
          {[vehicle.year, vehicle.make].filter(Boolean).join(' ')}
        </Text>
        <Text style={styles.model} numberOfLines={2}>
          {vehicle.model}
        </Text>
        <Text style={styles.caption}>Read its passport</Text>
      </View>
    </LiftPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 260,
    maxWidth: '100%',
    backgroundColor: colors.paper,
    borderRadius: radius.page,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.85 },
  gone: { backgroundColor: colors.paperShade },
  photo: { width: '100%', aspectRatio: 3 / 2, backgroundColor: colors.paperShade },
  body: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 },
  make: { fontFamily: fonts.bodySemi, fontSize: type.compact.fontSize, lineHeight: 20, color: colors.inkMuted },
  model: { fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 32, letterSpacing: -0.3, color: colors.ink, marginTop: 2 },
  caption: { ...type.caption, color: colors.inkMuted, marginTop: 6 },
  goneTitle: { fontFamily: fonts.bodySemi, fontSize: type.compact.fontSize, lineHeight: 22, color: colors.ink },
});
