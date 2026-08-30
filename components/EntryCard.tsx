import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatCents, KIND_LABELS, type LogEntry } from '../lib/log';
import { colors } from '../lib/theme';

/** Each kind gets its own colour so the timeline is scannable at a glance. */
const KIND_COLORS: Record<LogEntry['kind'], string> = {
  mod: '#E0584B',
  service: '#7FA8C0',
  repair: '#D89B4A',
  milestone: '#8FBF7F',
};

/** "15 Aug 2026" from "2026-08-15", without pulling in a date library. */
function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(day)} ${months[Number(month) - 1]} ${year}`;
}

export function EntryCard({ entry, onPress }: { entry: LogEntry; onPress?: () => void }) {
  const accent = KIND_COLORS[entry.kind];

  return (
    <Pressable
      style={({ pressed }) => [styles.card, { borderLeftColor: accent }, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.header}>
        <Text style={[styles.kind, { color: accent }]}>{KIND_LABELS[entry.kind]}</Text>
        <Text style={styles.date}>{formatDate(entry.occurredOn)}</Text>
      </View>

      <Text style={styles.title}>{entry.title}</Text>
      {entry.notes ? (
        <Text style={styles.notes} numberOfLines={3}>
          {entry.notes}
        </Text>
      ) : null}

      {entry.parts.length > 0 && (
        <View style={styles.parts}>
          {entry.parts.map((part, i) => (
            <Text key={i} style={styles.part}>
              {part.brand} {part.name}
              {part.partNumber ? `  ·  ${part.partNumber}` : ''}
            </Text>
          ))}
        </View>
      )}

      {(entry.odometer !== undefined || entry.costCents !== undefined) && (
        <View style={styles.meta}>
          {entry.odometer !== undefined && (
            <Text style={styles.metaItem}>{entry.odometer.toLocaleString()} mi</Text>
          )}
          {entry.costCents !== undefined && (
            <Text style={styles.metaItem}>{formatCents(entry.costCents)}</Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderLeftWidth: 3,
    padding: 16,
    gap: 6,
  },
  pressed: { opacity: 0.7 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kind: { fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: '700' },
  date: { color: colors.textFaint, fontSize: 12 },

  title: { color: colors.text, fontSize: 16, fontWeight: '600' },
  notes: { color: colors.textMuted, fontSize: 14, lineHeight: 19 },

  parts: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 3,
  },
  part: { color: colors.textMuted, fontSize: 13 },

  meta: { flexDirection: 'row', gap: 16, marginTop: 4 },
  metaItem: { color: colors.textFaint, fontSize: 13 },
});
