import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { loadMember, type Member, type MemberCar } from '../../lib/members';
import { regionLabel } from '../../lib/regions';
import { calendarSheet, formatClock, formatMonthYear } from '../../lib/dates';
import { describeError } from '../../lib/errors';
import { useAuth } from '../../lib/auth';
import { PhotoImage } from '../../components/PhotoImage';
import { FollowButton } from '../../components/FollowButton';
import { MessageButton } from '../../components/MessageButton';
import { Button, ErrorState, focusRing, SectionHeader, type PressState } from '../../components/ui';
import { colors, column, fonts, radius, type } from '../../lib/theme';

/**
 * A member's page. Route: /u/:handle
 *
 * Public like a passport, and for the same reason: it's what someone sends
 * when they want to show their cars. It holds only what the member already
 * published -- their name, region and the cars with a public passport -- plus
 * the meets they host, for other members.
 */
export default function MemberScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumped when the follow button flips, so the Message button re-checks.
  const [followChange, setFollowChange] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    loadMember(handle)
      .then(setMember)
      .catch((e) => setError(describeError(e)))
      .finally(() => setLoading(false));
  }, [handle]);

  useEffect(load, [load]);

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Stack.Screen options={{ headerShown: false, title: `@${handle}` }} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false, title: `@${handle}` }} />
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  if (!member) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Stack.Screen options={{ headerShown: false, title: 'Not found' }} />
        <Text style={styles.missingTitle}>Nobody to show at @{handle}</Text>
        <Text style={styles.missingBody}>
          There&apos;s no member with that handle, or they haven&apos;t published a car yet.
        </Text>
        <View style={styles.missingActions}>
          <Button
            label={session ? 'Back to your garage' : 'What is Sonder?'}
            onPress={() => router.replace(session ? '/' : '/welcome')}
          />
        </View>
      </View>
    );
  }

  const isMe = session?.user.id === member.id;
  const name = member.displayName ?? `@${member.handle}`;
  const place = regionLabel(member.region);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerShown: false, title: name }} />

      <View style={styles.topBar}>
        <Text style={styles.wordmark}>Sonder</Text>
        {router.canGoBack() ? (
          <Button label="Back" variant="subtle" onPress={() => router.back()} />
        ) : (
          <Text style={styles.docType}>Member</Text>
        )}
      </View>

      <View style={styles.identity}>
        <Text style={styles.name} accessibilityRole="header">
          {name}
        </Text>
        <Text style={styles.handleLine}>
          {member.displayName ? `@${member.handle}` : ''}
          {member.displayName && place ? ', ' : ''}
          {place ?? ''}
        </Text>
        <View style={styles.follow}>
          {isMe ? (
            <Text style={styles.selfNote}>
              This is your page. People see the cars you&apos;ve made public.
            </Text>
          ) : (
            <>
              <FollowButton kind="member" id={member.id} name={name} onChange={() => setFollowChange((n) => n + 1)} />
              <View style={styles.message}>
                <MessageButton memberId={member.id} name={name} refreshKey={followChange} />
              </View>
            </>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title={member.cars.length === 1 ? 'Their car' : 'Their cars'} />
        {member.cars.length === 0 ? (
          <Text style={styles.none}>No cars published right now.</Text>
        ) : (
          <View style={styles.cars}>
            {member.cars.map((car) => (
              <CarCard key={car.vehicleId} car={car} onPress={() => router.push(`/p/${car.vehicle.vin}`)} />
            ))}
          </View>
        )}
      </View>

      {member.meets.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Hosting" />
          {member.meets.map((meet) => {
            const sheet = calendarSheet(meet.startsAt);
            return (
              <Pressable
                key={meet.id}
                onPress={() => router.push(`/meet/${meet.id}`)}
                accessibilityRole="link"
                style={(state) => {
                  const { pressed, focused, hovered } = state as PressState;
                  return [styles.meet, (pressed || hovered) && styles.meetActive, focused && focusRing];
                }}
              >
                <View style={styles.sheet}>
                  <Text style={styles.sheetWeekday}>{sheet.weekday}</Text>
                  <Text style={styles.sheetDay}>{sheet.day}</Text>
                  <Text style={styles.sheetMonth}>{sheet.month}</Text>
                </View>
                <View style={styles.meetBody}>
                  <Text style={styles.meetTitle}>{meet.title}</Text>
                  <Text style={styles.meetWhere}>
                    {formatClock(meet.startsAt)}, {meet.place}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {!session && (
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
      )}
    </ScrollView>
  );
}

/** A published car, printed on paper like the passport it opens. */
function CarCard({ car, onPress }: { car: MemberCar; onPress: () => void }) {
  const { vehicle } = car;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${vehicle.year} ${vehicle.make} ${vehicle.model}${car.forSale ? ', for sale' : ''}`}
      style={(state) => {
        const { pressed, focused } = state as PressState;
        return [styles.card, pressed && styles.cardPressed, focused && focusRing];
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
      <View style={styles.cardBody}>
        <View style={styles.cardMain}>
          <Text style={styles.cardMake}>
            {vehicle.year} {vehicle.make}
          </Text>
          <Text style={styles.cardModel}>{vehicle.model}</Text>
          <Text style={styles.cardMeta}>Kept since {formatMonthYear(car.startedOn)}.</Text>
        </View>
        {car.forSale ? <Text style={styles.forSale}>For sale</Text> : null}
      </View>
    </Pressable>
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

  identity: { paddingHorizontal: 4, paddingTop: 8 },
  name: { ...type.hero, color: colors.text },
  handleLine: { ...type.body, color: colors.textMuted, marginTop: 4 },
  follow: { marginTop: 20 },
  // Under the follow row rather than beside it, so Following doesn't move when Message appears.
  message: { marginTop: 10, alignSelf: 'flex-start' },
  selfNote: { ...type.small, color: colors.textMuted },

  section: { marginTop: 40, paddingHorizontal: 4 },
  none: { ...type.body, color: colors.textMuted },
  cars: { gap: 16 },

  card: { backgroundColor: colors.paper, borderRadius: radius.page, overflow: 'hidden' },
  cardPressed: { opacity: 0.85 },
  photo: { width: '100%', aspectRatio: 16 / 10, backgroundColor: colors.paperShade },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
  },
  cardMain: { flex: 1 },
  cardMake: { fontFamily: fonts.bodySemi, fontSize: type.compact.fontSize, color: colors.inkMuted },
  cardModel: { ...type.display, fontSize: 30, lineHeight: 32, color: colors.ink, marginTop: 2 },
  cardMeta: { ...type.caption, color: colors.inkMuted, marginTop: 6 },
  // A rubber stamp on the page, in the ink that reads as red on paper.
  forSale: {
    fontFamily: fonts.displayBold,
    fontSize: 16,
    color: colors.stampInk,
    borderWidth: 2,
    borderColor: colors.stampInk,
    borderRadius: radius.tag,
    paddingHorizontal: 8,
    paddingVertical: 2,
    transform: [{ rotate: '-4deg' }],
  },

  meet: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: radius.control,
  },
  meetActive: { backgroundColor: colors.surface },
  sheet: {
    width: 64,
    backgroundColor: colors.paper,
    borderRadius: radius.input,
    alignItems: 'center',
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  sheetWeekday: { ...type.caption, color: colors.inkMuted },
  sheetDay: { fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 32, color: colors.ink },
  sheetMonth: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 16, color: colors.inkMuted },
  meetBody: { flex: 1, paddingTop: 2 },
  meetTitle: { fontFamily: fonts.bodySemi, fontSize: type.item.fontSize, lineHeight: 24, color: colors.text },
  meetWhere: { ...type.small, color: colors.textMuted, marginTop: 2 },

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
  footerLink: { fontFamily: fonts.bodySemi, fontSize: type.compact.fontSize, color: colors.accent, marginTop: 6 },

  missingTitle: { ...type.title, color: colors.text, textAlign: 'center' },
  missingBody: { ...type.body, color: colors.textMuted, textAlign: 'center', maxWidth: 400 },
  missingActions: { marginTop: 16, alignItems: 'center' },
});
