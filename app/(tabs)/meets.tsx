import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadMeets, type Meet } from '../../lib/meets';
import { regionLabel } from '../../lib/regions';
import { describeError } from '../../lib/errors';
import { useHomeRegion } from '../../components/useHomeRegion';
import { RegionPicker } from '../../components/RegionPicker';
import { Button, ErrorState } from '../../components/ui';
import { CoverTexture } from '../../components/CoverTexture';
import { MeetTicket as Ticket } from '../../components/MeetTicket';
import { Reveal } from '../../components/Reveal';
import { SkeletonBlock } from '../../components/Skeleton';
import { TabIcon } from '../../components/TabIcon';
import { useWide } from '../../components/useWide';
import { colors, column, radius, type } from '../../lib/theme';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function MeetsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const wide = useWide();
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

  // The soonest is the one most people came for; the rest are this week, then later.
  const groups = useMemo(() => {
    const list = meets ?? [];
    const [next, ...rest] = list;
    const soon = rest.filter((m) => new Date(m.startsAt).getTime() - Date.now() < WEEK_MS);
    const later = rest.filter((m) => !soon.includes(m));
    return { next, soon, later };
  }, [meets]);

  const post = () => router.push('/meet/new');

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <CoverTexture />
      <ScrollView contentContainerStyle={[styles.list, wide && styles.listWide]}>
        <Reveal rise={8} style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.titleText}>
              <Text style={[styles.title, wide && styles.titleWide]} accessibilityRole="header">
                Meets
              </Text>
              {wide ? (
                <Text style={styles.count}>
                  {meets === null
                    ? 'Looking for meets'
                    : `${meets.length} ${meets.length === 1 ? 'meet' : 'meets'} coming up${place ? ` in ${place}` : ''}`}
                </Text>
              ) : null}
            </View>
            {wide ? (
              <Button label="Post a meet" onPress={post} style={styles.post} glint />
            ) : (
              <Button label="Post a meet" variant="quiet" onPress={post} />
            )}
          </View>
          {!wide ? (
            <Text style={styles.intro}>
              Coffee, cars, a car park. Only members can see meets and who&apos;s coming.
            </Text>
          ) : null}
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
        </Reveal>

        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : meets === null ? (
          <View style={styles.grid} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.cell, wide && styles.cellWide]}>
                <SkeletonBlock style={styles.ghostTicket} />
              </View>
            ))}
          </View>
        ) : meets.length === 0 ? (
          <Reveal rise={10}>
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <TabIcon name="meets" active={false} color={colors.accent} accent={colors.accent} size={48} />
              </View>
              <Text style={styles.emptyTitle} accessibilityRole="header">
                {place ? `No meets coming up in ${place}` : 'No meets coming up'}
              </Text>
              <Text style={styles.emptyBody}>
                Start one. A Saturday morning in a big car park is how most of them begin.
              </Text>
              <Button label="Post a meet" onPress={post} variant={wide ? 'secondary' : 'primary'} style={styles.emptyButton} glint={!wide} />
            </View>
          </Reveal>
        ) : (
          <>
            {groups.next ? (
              <Reveal rise={14} index={1} style={styles.featured}>
                <Text style={styles.groupTitle}>Next up</Text>
                <Ticket
                  meet={groups.next}
                  big={wide}
                  showRegion={!region}
                  onPress={() => router.push(`/meet/${groups.next!.id}`)}
                />
              </Reveal>
            ) : null}
            <Group title="This week" meets={groups.soon} wide={wide} region={region} offset={2} />
            <Group title="Later" meets={groups.later} wide={wide} region={region} offset={2 + groups.soon.length} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Group({
  title,
  meets,
  wide,
  region,
  offset,
}: {
  title: string;
  meets: Meet[];
  wide: boolean;
  region: string;
  offset: number;
}) {
  const router = useRouter();
  if (meets.length === 0) return null;
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.grid}>
        {meets.map((meet, i) => (
          <Reveal key={meet.id} index={offset + i} rise={12} style={[styles.cell, wide && styles.cellWide]}>
            <Ticket meet={meet} showRegion={!region} onPress={() => router.push(`/meet/${meet.id}`)} />
          </Reveal>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: 20, paddingBottom: 40, flexGrow: 1, ...column },
  listWide: { maxWidth: 1120, paddingHorizontal: 48, paddingTop: 48, paddingBottom: 64 },

  header: { paddingTop: 20, marginBottom: 12 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 },
  titleText: { flex: 1 },
  title: { ...type.hero, color: colors.text },
  titleWide: { fontSize: 72, lineHeight: 68 },
  count: { ...type.lead, color: colors.textMuted, marginTop: 8 },
  post: { paddingHorizontal: 28 },
  intro: { ...type.body, color: colors.textMuted, marginTop: 10, maxWidth: 520 },
  filter: { marginTop: 20, maxWidth: 420 },

  featured: { marginTop: 24 },
  group: { marginTop: 36 },
  groupTitle: { ...type.title, color: colors.text, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 8 },
  cell: { width: '100%' },
  cellWide: { width: '48.9%' },
  ghostTicket: { height: 132, borderRadius: radius.page },



  empty: { paddingTop: 40, maxWidth: 480 },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { ...type.display, color: colors.text, marginTop: 24 },
  emptyBody: { ...type.lead, color: colors.textMuted, marginTop: 12 },
  emptyButton: { marginTop: 28, alignSelf: 'flex-start', paddingHorizontal: 28 },
});
