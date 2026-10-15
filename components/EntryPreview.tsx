import { StyleSheet, Text, View } from 'react-native';
import { formatCents, KIND_LABELS, type EntryKind, type Part } from '../lib/log';
import { formatDay } from '../lib/dates';
import { colors, fonts, KIND_COLORS_ON_PAPER, radius, type } from '../lib/theme';
import { Guilloche } from './Guilloche';
import { PhotoImage } from './PhotoImage';

/**
 * The entry as it will be printed in the car's log, drawn live while the form
 * is filled in. It is the same page a buyer will read (paper, guilloché, the
 * kind's own ink), so what you type is what they see.
 */
export function EntryPreview({
  kind,
  title,
  occurredOn,
  odometer,
  notes,
  parts,
  costCents,
  photos,
}: {
  kind: EntryKind;
  title: string;
  occurredOn: string;
  odometer?: number;
  notes?: string;
  parts: Part[];
  costCents?: number;
  /** Thumbnails to show: uploaded photos and ones just chosen. */
  photos: { key: string; uri: string }[];
}) {
  const ink = KIND_COLORS_ON_PAPER[kind];
  const date = /^\d{4}-\d{2}-\d{2}$/.test(occurredOn) ? formatDay(occurredOn) : occurredOn || 'No date';
  const filled = parts.filter((p) => p.brand.trim() || p.name.trim());

  return (
    <View style={styles.card} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Guilloche opacity={0.28} />
      <View style={styles.header}>
        <View style={styles.kindRow}>
          <View style={[styles.dot, { backgroundColor: ink }]} />
          <Text style={[styles.kind, { color: ink }]}>{KIND_LABELS[kind]}</Text>
        </View>
        <Text style={styles.date}>{date}</Text>
      </View>

      <Text style={[styles.title, !title.trim() && styles.placeholder]} numberOfLines={3}>
        {title.trim() || 'Untitled entry'}
      </Text>
      {odometer !== undefined ? (
        <Text style={styles.miles}>{odometer.toLocaleString('en-US')} mi</Text>
      ) : null}
      {notes?.trim() ? (
        <Text style={styles.notes} numberOfLines={4}>
          {notes.trim()}
        </Text>
      ) : null}

      {photos.length > 0 ? (
        <View style={styles.photos}>
          {photos.slice(0, 3).map((photo) => (
            <PhotoImage key={photo.key} thumbUrl={photo.uri} url={photo.uri} style={styles.photo} />
          ))}
          {photos.length > 3 ? <Text style={styles.more}>+{photos.length - 3}</Text> : null}
        </View>
      ) : null}

      {filled.length > 0 ? (
        <View style={styles.parts}>
          {filled.map((part, i) => (
            <View key={i} style={[styles.partRow, i > 0 && styles.partRule]}>
              <Text style={styles.partName}>
                <Text style={styles.partBrand}>{part.brand}</Text> {part.name}
              </Text>
              {part.partNumber?.trim() ? <Text style={styles.partNumber}>{part.partNumber.trim()}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      {costCents !== undefined ? <Text style={styles.cost}>{formatCents(costCents)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.page,
    paddingVertical: 18,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  kind: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 18 },
  date: { ...type.caption, color: colors.inkMuted },
  title: { fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 32, color: colors.ink, marginTop: 10 },
  placeholder: { color: colors.inkMuted },
  miles: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.inkMuted, marginTop: 4, fontVariant: ['tabular-nums'] },
  notes: { fontFamily: fonts.body, fontSize: type.compact.fontSize, lineHeight: 22, color: colors.inkMuted, marginTop: 10 },
  photos: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  photo: { width: 96, height: 72, borderRadius: radius.photo, backgroundColor: colors.paperShade },
  more: { ...type.small, color: colors.inkMuted },
  parts: { marginTop: 14, borderTopWidth: 1, borderTopColor: colors.paperLine },
  partRow: { paddingVertical: 9 },
  partRule: { borderTopWidth: 1, borderTopColor: colors.paperLine },
  partName: { ...type.small, color: colors.inkMuted },
  partBrand: { fontFamily: fonts.bodySemi, color: colors.ink },
  partNumber: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 16, color: colors.inkMuted, marginTop: 2 },
  cost: { fontFamily: fonts.bodySemi, fontSize: 17, color: colors.ink, marginTop: 12, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
