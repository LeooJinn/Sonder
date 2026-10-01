import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
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
  const { session } = useAuth();
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

  async function start(person: MessagePerson) {
    setStarting(person.id);
    setStartError(null);
    try {
      router.push(`/messages/${await startConversation(person.id)}`);
    } catch (e) {
      setStartError(describeError(e));
    } finally {
      setStarting(null);
    }
  }

  if (error && !inbox) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Messages' }} />
        <ErrorState message={error} onRetry={() => load()} />
      </View>
    );
  }

  const talking = new Set((inbox ?? []).map((item) => item.other?.id).filter(Boolean));
  const startable = mutuals.filter((person) => !talking.has(person.id));
  const empty = inbox !== null && inbox.length === 0;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Messages' }} />

      <FlatList
        data={inbox ?? []}
        keyExtractor={(item) => item.conversationId}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
        renderItem={({ item }) => (
          <Row item={item} onPress={() => router.push(`/messages/${item.conversationId}`)} />
        )}
        ListEmptyComponent={
          inbox === null ? (
            <ActivityIndicator color={colors.accent} style={styles.loading} />
          ) : empty ? (
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
    </View>
  );
}

/** One conversation: who, the last thing said, when, and whether there's news. */
function Row({ item, onPress }: { item: InboxItem; onPress: () => void }) {
  const name = ownerName(item.other, 'A member who left');
  const unread = item.unread > 0;
  const preview = `${item.lastFromMe ? 'You: ' : ''}${item.lastBody}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}${unread ? `, ${item.unread} unread` : ''}${item.canReply ? '' : ', closed'}. ${preview}`}
      style={(state) => {
        const { pressed, focused, hovered } = state as PressState;
        return [styles.row, (pressed || hovered) && styles.rowActive, focused && focusRing];
      }}
    >
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
  content: { ...column, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 56 },
  loading: { marginTop: 48 },

  row: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginHorizontal: -12,
    borderRadius: 10,
    borderBottomWidth: 0,
  },
  rowActive: { backgroundColor: colors.surface },
  rowMain: { gap: 3 },
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
