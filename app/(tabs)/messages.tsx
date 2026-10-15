import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  loadInbox,
  loadMutuals,
  startConversation,
  type InboxItem,
  type MessagePerson,
} from '../../lib/messages';
import { formatInboxTime } from '../../lib/dates';
import { describeError } from '../../lib/errors';
import { useAuth } from '../../lib/auth';
import { Monogram } from '../../components/Monogram';
import { TabIcon } from '../../components/TabIcon';
import { ThreadView } from '../../components/ThreadView';
import { useTwoPane } from '../../components/useWide';
import { CoverTexture } from '../../components/CoverTexture';
import { Reveal } from '../../components/Reveal';
import { SkeletonBlock } from '../../components/Skeleton';
import { ownerName } from '../../components/Timeline';
import { Button, ErrorState, focusRing, type PressState } from '../../components/ui';
import { colors, column, fonts, type } from '../../lib/theme';

/**
 * Conversations, newest first, then the members you could start one with.
 *
 * Messaging is only between members who follow each other, so the second
 * list is the door in: nobody here is a stranger. A row that has gone quiet
 * and shut (the follow ended, or someone blocked) stays, because it's still
 * a record of what was said.
 */
export default function MessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  // "wide" here means the two-pane layout, which needs more room than the side rail does.
  const wide = useTwoPane();
  const params = useLocalSearchParams<{ c?: string }>();
  // Wide screens show the conversation beside the inbox instead of opening a new screen.
  const [selected, setSelected] = useState<string | null>(params.c ?? null);
  const [inbox, setInbox] = useState<InboxItem[] | null>(null);
  const [mutuals, setMutuals] = useState<MessagePerson[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const loadedOnce = useRef(false);

  const load = useCallback(
    (quiet = false) => {
      if (!session) return;
      if (!quiet) setError(null);
      return Promise.all([loadInbox(), loadMutuals().catch(() => [] as MessagePerson[])])
        .then(([items, people]) => {
          setInbox(items);
          setMutuals(people);
          loadedOnce.current = true;
        })
        .catch((e) => {
          if (!quiet) setError(describeError(e));
        });
    },
    [session]
  );

  // Every visit, quietly after the first, so the list stays put while it refreshes.
  useFocusEffect(
    useCallback(() => {
      load(loadedOnce.current);
    }, [load])
  );

  async function refresh() {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }

  useEffect(() => {
    if (params.c) setSelected(params.c);
  }, [params.c]);

  // Opening a conversation marks it read; pick that up in the list a moment later.
  useEffect(() => {
    if (!selected || !wide) return;
    const timer = setTimeout(() => load(true), 1600);
    return () => clearTimeout(timer);
  }, [selected, wide, load]);

  function open(conversationId: string) {
    if (wide) setSelected(conversationId);
    else router.push(`/messages/${conversationId}`);
  }

  async function start(person: MessagePerson) {
    setStarting(person.id);
    setStartError(null);
    try {
      open(await startConversation(person.id));
    } catch (e) {
      setStartError(describeError(e));
    } finally {
      setStarting(null);
    }
  }

  if (error && !inbox) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false, title: 'Messages' }} />
        <ErrorState message={error} onRetry={() => load()} />
      </View>
    );
  }

  const talking = new Set((inbox ?? []).map((item) => item.other?.id).filter(Boolean));
  const startable = mutuals.filter((person) => !talking.has(person.id));
  const empty = inbox !== null && inbox.length === 0;

  const list = (
      <FlatList
        data={inbox ?? []}
        keyExtractor={(item) => item.conversationId}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
        ListHeaderComponent={
          <Reveal rise={8} style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              Messages
            </Text>
          </Reveal>
        }
        renderItem={({ item, index }) => (
          <Reveal index={index} rise={10}>
            <Row item={item} selected={wide && selected === item.conversationId} onPress={() => open(item.conversationId)} />
          </Reveal>
        )}
        ListEmptyComponent={
          inbox === null ? (
            <View style={styles.loading} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.ghost}>
                  <SkeletonBlock style={styles.ghostSeal} />
                  <View style={styles.ghostText}>
                    <SkeletonBlock style={{ height: 16, width: '42%' }} />
                    <SkeletonBlock style={{ height: 13, width: '78%', marginTop: 9 }} />
                  </View>
                </View>
              ))}
            </View>
          ) : empty && !wide ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle} accessibilityRole="header">
                No messages yet
              </Text>
              <Text style={styles.emptyBody}>
                You can message members you follow who follow you back. Follow people from a
                meet&apos;s list of who&apos;s going or from their page, and once they follow you
                too, they show up here.
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          startable.length > 0 ? (
            <View style={styles.starters}>
              <Text style={styles.startersTitle} accessibilityRole="header">
                {empty ? 'You can message' : 'Start a conversation'}
              </Text>
              {startError ? <Text style={styles.startError}>{startError}</Text> : null}
              {startable.map((person) => (
                <View key={person.id} style={styles.starter}>
                  <View style={styles.starterText}>
                    <Text style={styles.starterName} numberOfLines={1}>
                      {ownerName(person, 'A member')}
                    </Text>
                    {person.displayName && person.handle ? (
                      <Text style={styles.starterHandle} numberOfLines={1}>
                        @{person.handle}
                      </Text>
                    ) : null}
                  </View>
                  <Button
                    label="Message"
                    variant="quiet"
                    busy={starting === person.id}
                    onPress={() => start(person)}
                    accessibilityHint={`Opens a conversation with ${ownerName(person, 'this member')}`}
                  />
                </View>
              ))}
            </View>
          ) : null
        }
      />
  );

  if (!wide) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false, title: 'Messages' }} />
        <CoverTexture />
        {list}
      </View>
    );
  }

  return (
    <View style={[styles.screen, styles.split]}>
      <Stack.Screen options={{ headerShown: false, title: 'Messages' }} />
      <View style={[styles.paneList, { paddingTop: insets.top + 24 }]}>{list}</View>
      <View style={styles.paneThread}>
        {selected ? (
          <ThreadView
            key={selected}
            id={selected}
            embedded
            onLeave={() => {
              setSelected(null);
              router.setParams({ c: '' });
              load(true);
            }}
          />
        ) : (
          <View style={styles.pick}>
            <CoverTexture />
            <Reveal rise={10}>
              <View style={styles.pickIcon}>
                <TabIcon name="messages" active={false} color={colors.accent} accent={colors.accent} size={56} />
              </View>
            </Reveal>
            <Reveal rise={10} index={1}>
              <Text style={styles.pickTitle}>{empty ? 'Nothing here yet' : 'Pick a conversation'}</Text>
              <Text style={styles.pickBody}>
                {empty
                  ? 'Follow people and have them follow you back, and you can write to each other here.'
                  : 'Your messages open here, beside the list. Cars you send arrive as a small paper page.'}
              </Text>
            </Reveal>
          </View>
        )}
      </View>
    </View>
  );
}

/** One conversation: who, the last thing said, when, and whether there's news. */
function Row({ item, selected, onPress }: { item: InboxItem; selected?: boolean; onPress: () => void }) {
  const name = ownerName(item.other, 'A member who left');
  const unread = item.unread > 0;
  const preview = `${item.lastFromMe ? 'You: ' : ''}${item.lastBody}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={`${name}${unread ? `, ${item.unread} unread` : ''}${item.canReply ? '' : ', closed'}. ${preview}`}
      style={(state) => {
        const { pressed, focused, hovered } = state as PressState;
        return [styles.row, (pressed || hovered || selected) && styles.rowActive, focused && focusRing];
      }}
    >
      {selected ? <View style={styles.rowRule} /> : null}
      <Monogram name={name} />
      <View style={styles.rowMain}>
        <View style={styles.rowTop}>
          <Text style={[styles.name, !unread && styles.nameRead]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.time}>{formatInboxTime(item.lastAt)}</Text>
        </View>
        <View style={styles.rowBottom}>
          <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={2}>
            {preview}
          </Text>
          {unread ? <View style={styles.dot} /> : null}
        </View>
        {item.lastHasCar || !item.canReply ? (
          <Text style={styles.tags}>
            {[item.lastHasCar ? 'With a car' : null, !item.canReply ? 'Closed' : null]
              .filter(Boolean)
              .join(', ')}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  split: { flexDirection: 'row' },
  paneList: { width: 400, borderRightWidth: 1, borderRightColor: colors.border },
  paneThread: { flex: 1, minWidth: 0 },
  pick: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, overflow: 'hidden' },
  pickIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  pickTitle: { ...type.display, color: colors.text, textAlign: 'center', marginTop: 24 },
  pickBody: { ...type.lead, color: colors.textMuted, textAlign: 'center', marginTop: 12, maxWidth: 420 },
  content: { ...column, paddingHorizontal: 20, paddingBottom: 32, flexGrow: 1 },
  header: { paddingTop: 20, marginBottom: 14 },
  title: { ...type.hero, color: colors.text },
  loading: { marginTop: 8, gap: 22 },
  ghost: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ghostSeal: { width: 46, height: 46, borderRadius: 23 },
  ghostText: { flex: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginHorizontal: -12,
    borderRadius: 10,
    borderBottomWidth: 0,
  },
  rowActive: { backgroundColor: colors.surface },
  // The conversation open beside the list: foil marks where you are.
  rowRule: { position: 'absolute', left: 0, top: 14, bottom: 14, width: 3, borderRadius: 2, backgroundColor: colors.accent },
  rowMain: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  name: { ...type.item, flex: 1, color: colors.text },
  nameRead: { fontFamily: fonts.bodyMedium },
  time: { ...type.caption, color: colors.textFaint },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  preview: { ...type.compact, flex: 1, color: colors.textMuted },
  previewUnread: { color: colors.text },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  tags: { ...type.caption, color: colors.textFaint },

  empty: { paddingTop: 40, paddingBottom: 8, maxWidth: 440 },
  emptyTitle: { ...type.title, color: colors.text },
  emptyBody: { ...type.lead, color: colors.textMuted, marginTop: 10 },

  starters: { marginTop: 40, paddingTop: 24, borderTopWidth: 1, borderTopColor: colors.border },
  startersTitle: { ...type.heading, color: colors.text, marginBottom: 6 },
  startError: { ...type.small, color: colors.danger, marginTop: 6 },
  starter: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  starterText: { flex: 1 },
  starterName: { ...type.item, color: colors.text },
  starterHandle: { ...type.small, color: colors.textMuted },
});
