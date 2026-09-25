import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadMeets, type Meet } from '../../lib/meets';
import { calendarSheet, formatClock } from '../../lib/dates';
import { regionLabel } from '../../lib/regions';
import { describeError } from '../../lib/errors';
import { useHomeRegion } from '../../components/useHomeRegion';
import { RegionPicker } from '../../components/RegionPicker';
import { ownerName } from '../../components/Timeline';
import { Button, ErrorState, focusRing, type PressState } from '../../components/ui';
import { colors, column, fonts, radius, type } from '../../lib/theme';

export default function MeetsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [region, setRegion, regionReady] = useHomeRegion();
  const [meets, setMeets] = useState<Meet[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // On focus, so a meet just posted or joined is reflected on the way back.
  const load = useCallback(() => {
    if (!regionReady) return;
    setError(null);
    loadMeets(region || undefined)
      .then(setMeets)
      .catch((e) => setError(describeError(e)));
  }, [region, regionReady]);

  useFocusEffect(load);

  const place = regionLabel(region);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <FlatList
        data={meets ?? []}
        keyExtractor={(meet) => meet.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.title} accessibilityRole="header">
                Meets
              </Text>
              <Button label="Post a meet" variant="quiet" onPress={() => router.push('/meet/new')} />
            </View>
            <Text style={styles.intro}>
              Coffee, cars, a car park. Only members can see meets and who&apos;s coming.
            </Text>
            <View style={styles.filter}>
              <RegionPicker
                value={region}
                onChange={(next) => {
                  setMeets(null);
                  setRegion(next);
                }}
                emptyLabel="Everywhere"
                placeholder="Everywhere"
                title="Show meets in"
              />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <MeetRow meet={item} showRegion={!region} onPress={() => router.push(`/meet/${item.id}`)} />
        )}
        ListEmptyComponent={
          error ? (
            <ErrorState message={error} onRetry={load} />
          ) : meets === null ? (
            <ActivityIndicator color={colors.accent} style={styles.loading} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {place ? `No meets coming up in ${place}` : 'No meets coming up'}
              </Text>
              <Text style={styles.emptyBody}>
                Start one. A Saturday morning in a big car park is how most of them begin.
              </Text>
              <Button
                label="Post a meet"
                onPress={() => router.push('/meet/new')}
                style={styles.emptyButton}
              />
            </View>
          )
        }
      />
    </View>
  );
}

/**
 * One meet: its date as a calendar sheet on the left, because "when" is the
 * first thing anyone scans a list of meets for, then what, where and who.
 */
function MeetRow({ meet, showRegion, onPress }: { meet: Meet; showRegion: boolean; onPress: () => void }) {
  const sheet = calendarSheet(meet.startsAt);
  const where = [meet.place, showRegion ? regionLabel(meet.region) : undefined].filter(Boolean).join(', ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={(state) => {
        const { pressed, focused, hovered } = state as PressState;
        return [styles.row, (pressed || hovered) && styles.rowActive, focused && focusRing];
      }}
    >
      <View style={styles.sheet}>
        <Text style={styles.sheetWeekday}>{sheet.weekday}</Text>
        <Text style={styles.sheetDay}>{sheet.day}</Text>
        <Text style={styles.sheetMonth}>{sheet.month}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{meet.title}</Text>
        <Text style={styles.rowWhere}>
          {formatClock(meet.startsAt)}, {where}
        </Text>
        <Text style={styles.rowWho}>
          {meet.isMine ? 'Your meet' : `Hosted by ${ownerName(meet.host, 'a member')}`}.{' '}
          {meet.goingCount} going.
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: 20, paddingBottom: 32, gap: 8, flexGrow: 1, ...column },

  header: { paddingTop: 20, marginBottom: 12 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { ...type.hero, color: colors.text },
  intro: { ...type.body, color: colors.textMuted, marginTop: 10, maxWidth: 520 },
  filter: { marginTop: 20 },

  loading: { marginTop: 48 },

  row: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: radius.control,
  },
  rowActive: { backgroundColor: colors.surface },
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
  rowBody: { flex: 1, paddingTop: 2 },
  rowTitle: { fontFamily: fonts.bodySemi, fontSize: 18, lineHeight: 24, color: colors.text },
  rowWhere: { ...type.small, color: colors.textMuted, marginTop: 2 },
  rowWho: { ...type.small, color: colors.textFaint, marginTop: 2 },

  empty: { paddingTop: 24, maxWidth: 460 },
  emptyTitle: { ...type.title, color: colors.text },
  emptyBody: { ...type.body, color: colors.textMuted, marginTop: 10 },
  emptyButton: { marginTop: 24, alignSelf: 'flex-start' },
});
