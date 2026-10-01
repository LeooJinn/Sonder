import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  clearConversation,
  loadEarlierMessages,
  loadLatestMessages,
  loadThread,
  markRead,
  sendMessage,
  type ClosedReason,
  type Message,
  type MessageCar,
  type Thread,
} from '../../lib/messages';
import { blockMember, reportMessage } from '../../lib/moderation';
import { formatClock, formatMessageDay } from '../../lib/dates';
import { describeError } from '../../lib/errors';
import { useAuth } from '../../lib/auth';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { MessageCarCard } from '../../components/MessageCarCard';
import { MessageComposer } from '../../components/MessageComposer';
import { Reveal } from '../../components/Reveal';
import { ReportSheet } from '../../components/ReportSheet';
import { ownerName } from '../../components/Timeline';
import { Button, ErrorState, focusRing, type PressState } from '../../components/ui';
import { colors, column, fonts, radius, type } from '../../lib/theme';

/** How often an open conversation asks whether anything new has arrived. */
const POLL_MS = 8000;

/** Messages from one person within this many minutes read as one run. */
const RUN_MINUTES = 5;

type Row =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'message'; key: string; message: Message; endOfRun: boolean };

function byTime(a: Message, b: Message) {
  return a.at < b.at ? -1 : a.at > b.at ? 1 : 0;
}

/** Messages already on screen plus ones just fetched, once each, oldest first. */
function merge(current: Message[], incoming: Message[]): Message[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort(byTime);
}

/** The list as rows: a day label where the day changes, and a time at the end of each run. */
function toRows(messages: Message[]): Row[] {
  const rows: Row[] = [];
  messages.forEach((message, i) => {
    const previous = messages[i - 1];
    const next = messages[i + 1];
    const newDay = !previous || formatMessageDay(previous.at) !== formatMessageDay(message.at);
    if (newDay) rows.push({ kind: 'day', key: `day:${message.id}`, label: formatMessageDay(message.at) });

    const continues =
      next &&
      next.senderId === message.senderId &&
      formatMessageDay(next.at) === formatMessageDay(message.at) &&
      new Date(next.at).getTime() - new Date(message.at).getTime() < RUN_MINUTES * 60_000;
    rows.push({ kind: 'message', key: message.id, message, endOfRun: !continues });
  });
  return rows;
}

const CLOSED_NOTE: Record<ClosedReason, string> = {
  ended: 'This conversation is closed. You can write again when you both follow each other.',
  left: 'This member has left Sonder, so there is no one to write to.',
  paused:
    'Your messaging is paused after reports from other members. You can still read your conversations.',
};

/**
 * One conversation. Route: /messages/:id
 *
 * Messages sit on the cover, yours on the right a step lighter than theirs;
 * a car sent in one is a small paper page, because it's about a specific car.
 * Nothing here is editable after it's sent: a report has to point at what
 * was actually said.
 */
export default function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [thread, setThread] = useState<Thread | null>(null);
  const [missing, setMissing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [askingBlock, setAskingBlock] = useState(false);
  const [askingDelete, setAskingDelete] = useState(false);

  const list = useRef<FlatList<Row>>(null);
  const atBottom = useRef(true);
  const seen = useRef(new Set<string>());
  // Set once the first page has been shown. Anything that arrives after that
  // comes in with a little motion; the history you open to doesn't.
  const opened = useRef(false);

  const load = useCallback(
    (quiet = false) => {
      if (!session || !id) return;
      if (!quiet) setError(null);
      return loadThread(id)
        .then((next) => {
          if (!next) {
            setMissing(true);
            return;
          }
          setThread(next);
          setMessages((current) => merge(current, next.messages));
          setHasMore((current) => (quiet ? current : next.hasMore));
          markRead(id).catch(() => {});
        })
        .catch((e) => {
          if (!quiet) setError(describeError(e));
        });
    },
    [session, id]
  );

  // Load on arrival, then every few seconds while this screen is in view.
  // Quietly: a failed poll leaves the conversation as it is.
  useFocusEffect(
    useCallback(() => {
      load(thread !== null);
      const timer = setInterval(() => {
        if (!id) return;
        loadLatestMessages(id)
          .then((latest) => {
            const fresh = latest.filter((m) => !seen.current.has(m.id));
            if (fresh.length === 0) return;
            setMessages((current) => merge(current, latest));
            if (fresh.some((m) => !m.mine)) markRead(id).catch(() => {});
          })
          .catch(() => {});
      }, POLL_MS);
      return () => clearInterval(timer);
      // `thread` only decides whether this first load is quiet; it must not restart the timer.
    }, [load, id])
  );

  useEffect(() => {
    for (const m of messages) seen.current.add(m.id);
    if (messages.length > 0) opened.current = true;
  }, [messages]);

  const rows = useMemo(() => toRows(messages), [messages]);

  async function send(body: string, car?: MessageCar) {
    if (!id) return;
    const sent = await sendMessage(id, body, car);
    atBottom.current = true;
    setMessages((current) => merge(current, [sent]));
  }

  async function earlier() {
    if (!id || loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const page = await loadEarlierMessages(id, messages[0].at);
      atBottom.current = false;
      setMessages((current) => merge(current, page.messages));
      setHasMore(page.hasMore);
    } catch {
      // Leave it; asking again retries.
    } finally {
      setLoadingMore(false);
    }
  }

  const other = thread?.other;
  const name = ownerName(other, 'A member who left');
  const title = other ? name : 'Messages';

  if (missing) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Stack.Screen options={{ title: 'Messages' }} />
        <Text style={styles.missingTitle}>This conversation isn&apos;t here</Text>
        <Text style={styles.missingBody}>
          It may have been deleted, or it belongs to someone else&apos;s account.
        </Text>
        <View style={styles.missingAction}>
          <Button label="Back to messages" variant="secondary" onPress={() => router.replace('/messages')} />
        </View>
      </View>
    );
  }

  if (error && !thread) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Messages' }} />
        <ErrorState message={error} onRetry={() => load()} />
      </View>
    );
  }

  if (!thread) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Stack.Screen options={{ title: 'Messages' }} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 56 + insets.top : 0}
    >
      <Stack.Screen options={{ title }} />

      <FlatList
        ref={list}
        data={rows}
        keyExtractor={(row) => row.key}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (atBottom.current) list.current?.scrollToEnd({ animated: false });
        }}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          atBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 80;
        }}
        scrollEventThrottle={100}
        ListHeaderComponent={
          <View style={styles.top}>
            {other ? (
              <View style={styles.identity}>
                <Text style={styles.name} accessibilityRole="header">
                  {name}
                </Text>
                {other.displayName && other.handle ? (
                  <Text style={styles.handle}>@{other.handle}</Text>
                ) : null}
              </View>
            ) : null}
            <View style={styles.actions}>
              {other?.handle ? (
                <Button label="View profile" variant="subtle" onPress={() => router.push(`/u/${other.handle}`)} />
              ) : null}
              <Button label="Delete conversation" variant="subtle" onPress={() => setAskingDelete(true)} />
              {other ? <Button label="Block" variant="subtle" onPress={() => setAskingBlock(true)} /> : null}
            </View>
            {hasMore ? (
              <View style={styles.earlier}>
                <Button
                  label="Earlier messages"
                  variant="secondary"
                  busy={loadingMore}
                  onPress={earlier}
                  style={styles.earlierButton}
                />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) =>
          item.kind === 'day' ? (
            <View style={styles.day}>
              <View style={styles.dayRule} />
              <Text style={styles.dayLabel}>{item.label}</Text>
              <View style={styles.dayRule} />
            </View>
          ) : (
            <Bubble
              message={item.message}
              fresh={opened.current && !seen.current.has(item.message.id)}
              endOfRun={item.endOfRun}
              open={selected === item.message.id}
              onToggle={() => setSelected((now) => (now === item.message.id ? null : item.message.id))}
              onReport={() => setReporting(item.message.id)}
            />
          )
        }
      />

      <View style={[styles.foot, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.footInner}>
          {thread.canReply ? (
            <MessageComposer onSend={send} />
          ) : (
            <Text style={styles.closed} accessibilityLiveRegion="polite">
              {CLOSED_NOTE[thread.closedReason ?? 'ended']}
            </Text>
          )}
        </View>
      </View>

      <ReportSheet
        visible={reporting !== null}
        what="message"
        outcome="Thanks. Every report is read, and when three different members report what someone sends, their messaging is paused until someone has looked."
        onSubmit={(reason, note) => reportMessage(reporting!, reason, note)}
        onClose={() => setReporting(null)}
      />

      <ConfirmDialog
        visible={askingBlock}
        title={`Block ${name}?`}
        body="You won't see their meets or the cars they sell, and this conversation closes for both of you. They aren't told. You can unblock them from your profile."
        confirmLabel="Block"
        onConfirm={async () => {
          if (other) await blockMember(other.id);
          router.replace('/messages');
        }}
        onCancel={() => setAskingBlock(false)}
      />

      <ConfirmDialog
        visible={askingDelete}
        title="Delete this conversation?"
        body={`It disappears from your messages. ${other ? name : 'The other member'} keeps their copy, and if they write again you'll see only the new messages.`}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (id) await clearConversation(id);
          router.replace('/messages');
        }}
        onCancel={() => setAskingDelete(false)}
      />
    </KeyboardAvoidingView>
  );
}

/**
 * One message. Theirs can be tapped to show the time and a Report link;
 * the report option is there when someone needs it and gone from the page
 * the rest of the time.
 */
function Bubble({
  message,
  fresh,
  endOfRun,
  open,
  onToggle,
  onReport,
}: {
  message: Message;
  /** Arrived just now, so it comes in rather than being there. */
  fresh: boolean;
  endOfRun: boolean;
  open: boolean;
  onToggle: () => void;
  onReport: () => void;
}) {
  const mine = message.mine;

  const content = (
    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
      <Text style={styles.body} selectable>
        {message.body}
      </Text>
    </View>
  );

  const bubble = (
    <View style={[styles.message, mine ? styles.messageMine : styles.messageTheirs, endOfRun && styles.messageEnd]}>
      {mine ? (
        content
      ) : (
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel={`Message: ${message.body}`}
          accessibilityHint={open ? 'Hides the report option' : 'Shows the time and a way to report this message'}
          style={(state) => [styles.bubbleButton, (state as PressState).focused && focusRing]}
        >
          {content}
        </Pressable>
      )}

      {message.hasCar ? (
        <View style={styles.car}>
          <MessageCarCard car={message.car} />
        </View>
      ) : null}

      {endOfRun || open ? (
        <View style={styles.meta}>
          <Text style={styles.time}>{formatClock(message.at)}</Text>
          {open && !mine ? <Button label="Report" variant="subtle" onPress={onReport} /> : null}
        </View>
      ) : null}
    </View>
  );

  return fresh ? <Reveal rise={10}>{bubble}</Reveal> : bubble;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 32, gap: 10 },
  list: { flex: 1 },
  listContent: { ...column, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },

  top: { paddingBottom: 8 },
  identity: { paddingTop: 8 },
  name: { ...type.title, color: colors.text },
  handle: { ...type.small, color: colors.textMuted, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, marginTop: 14, marginBottom: 2 },
  earlier: { alignItems: 'center', marginTop: 16 },
  earlierButton: { minHeight: 44 },

  day: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 22, marginBottom: 12 },
  dayRule: { flex: 1, height: 1, backgroundColor: colors.border },
  dayLabel: { ...type.caption, color: colors.textFaint },

  message: { marginTop: 4, maxWidth: '100%' },
  messageMine: { alignItems: 'flex-end' },
  messageTheirs: { alignItems: 'flex-start' },
  messageEnd: { marginBottom: 10 },
  bubbleButton: { maxWidth: '84%', borderRadius: radius.control },
  bubble: { maxWidth: '100%', borderRadius: radius.control, paddingHorizontal: 14, paddingVertical: 10 },
  // Theirs sits a step above the cover; yours a step above that. Alignment
  // says who spoke, the tone only backs it up. Foil stays for Send.
  bubbleTheirs: { backgroundColor: colors.surface },
  bubbleMine: { backgroundColor: colors.border, maxWidth: '84%' },
  body: { ...type.body, color: colors.text },
  car: { marginTop: 6, maxWidth: '100%' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4, minHeight: 20 },
  time: { ...type.caption, color: colors.textFaint },

  foot: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background, paddingTop: 12 },
  footInner: { ...column, paddingHorizontal: 20 },
  closed: { ...type.small, color: colors.textMuted, paddingVertical: 8 },

  missingTitle: { ...type.title, color: colors.text, textAlign: 'center' },
  missingBody: { ...type.body, color: colors.textMuted, textAlign: 'center', maxWidth: 400 },
  missingAction: { marginTop: 16 },
});
