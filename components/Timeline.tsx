import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PhotoImage } from './PhotoImage';
import { formatCents, KIND_LABELS, type LogEntry } from '../lib/log';
import { formatDay, formatMonthYear } from '../lib/dates';
import { colors, fonts, KIND_COLORS, KIND_COLORS_ON_PAPER, radius, type } from '../lib/theme';
import { Guilloche } from './Guilloche';
import { LiftPressable } from './LiftPressable';
import { focusRing, type PressState } from './ui';

/**
 * One owner's stretch of a car's life: a heading and the entries logged in it.
 * A car that has been sold reads as several chapters on one continuous line.
 */
export type Chapter = {
  key: string;
  title: string;
  subtitle: string;
  /** A sentence under the subtitle, e.g. that the chapter is read-only. */
  note?: string;
  entries: LogEntry[];
  /** What to show when the chapter has no entries. */
  empty: string;
  /** Omitted for chapters that can't be edited. */
  onPressEntry?: (entry: LogEntry) => void;
};

/** "4 entries, $3,149 logged." — the sums a buyer actually asks about. */
export function summarize(entries: LogEntry[]): string {
  if (entries.length === 0) return '';
  const spent = entries.reduce((total, e) => total + (e.costCents ?? 0), 0);
  const count = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;
  return spent > 0 ? `${count}, ${formatCents(spent)} logged.` : `${count}.`;
}

/** "Since June 2025." or "April 2008 to June 2025." */
export function period(startedOn: string, endedOn?: string): string {
  return endedOn
    ? `${formatMonthYear(startedOn)} to ${formatMonthYear(endedOn)}.`
    : `Since ${formatMonthYear(startedOn)}.`;
}

/** How to name an owner: their display name, their handle, or nobody in particular. */
export function ownerName(
  owner: { displayName?: string; handle?: string } | undefined,
  fallback = 'A previous owner'
): string {
  if (owner?.displayName) return owner.displayName;
  if (owner?.handle) return `@${owner.handle}`;
  return fallback;
}

/**
 * The build log as a timeline along the odometer. Mileage sits on the axis
 * because it's the car's own clock: two entries a year apart mean little
 * until you see they're 400 miles apart.
 */
export function Timeline({ chapters }: { chapters: Chapter[] }) {
  return (
    <View>
      {chapters.map((chapter, c) => {
        const isLastChapter = c === chapters.length - 1;
        const endsHere = isLastChapter && chapter.entries.length === 0;
        return (
          <View key={chapter.key}>
            <View style={styles.row}>
              <View style={styles.axis} />
              <View style={styles.rail}>
                <View
                  style={[
                    styles.line,
                    c === 0 && styles.lineFromMarker,
                    endsHere && styles.lineToMarker,
                  ]}
                />
                <View style={styles.chapterMarker} />
              </View>
              <View style={styles.chapterText}>
                <Text style={styles.chapterTitle} accessibilityRole="header">
                  {chapter.title}
                </Text>
                <Text style={styles.chapterSubtitle}>{chapter.subtitle}</Text>
                {chapter.note ? <Text style={styles.chapterNote}>{chapter.note}</Text> : null}
                {chapter.entries.length === 0 ? (
                  <Text style={styles.chapterEmpty}>{chapter.empty}</Text>
                ) : null}
              </View>
            </View>

            {chapter.entries.map((entry, i) => (
              <TimelineEntry
                key={entry.id}
                entry={entry}
                isLast={isLastChapter && i === chapter.entries.length - 1}
                onPress={chapter.onPressEntry ? () => chapter.onPressEntry!(entry) : undefined}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}

function TimelineEntry({
  entry,
  isLast,
  onPress,
}: {
  entry: LogEntry;
  isLast: boolean;
  onPress?: () => void;
}) {
  const ink = KIND_COLORS[entry.kind];
  const paperInk = KIND_COLORS_ON_PAPER[entry.kind];

  // A log entry is a printed line in the car's papers: security paper, ink, the
  // guilloché behind it. The kind's own ink stamps its dot and its label.
  const card = (
    <View style={styles.card}>
      <Guilloche opacity={0.28} />
      <View style={styles.entryHeader}>
        <View style={styles.kindRow}>
          <View style={[styles.kindDot, { backgroundColor: paperInk }]} />
          <Text style={[styles.kind, { color: paperInk }]}>{KIND_LABELS[entry.kind]}</Text>
        </View>
        <Text style={styles.date}>{formatDay(entry.occurredOn)}</Text>
      </View>

      <Text style={styles.title}>{entry.title}</Text>

      {entry.notes ? (
        <Text style={styles.notes} numberOfLines={4}>
          {entry.notes}
        </Text>
      ) : null}

      {entry.photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.photos}
          // Without this, dragging the strip is swallowed by the entry's press.
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.photoRow}>
            {entry.photos.map((photo) => (
              <PhotoImage
                key={photo.id}
                thumbUrl={photo.thumbUrl}
                url={photo.url}
                style={styles.photo}
                accessibilityLabel={`Photo from ${entry.title}`}
              />
            ))}
          </View>
        </ScrollView>
      )}

      {entry.parts.length > 0 && (
        <View style={styles.parts}>
          {entry.parts.map((part, i) => (
            <View key={i} style={[styles.partRow, i > 0 && styles.partRowRule]}>
              <Text style={styles.partName}>
                <Text style={styles.partBrand}>{part.brand}</Text> {part.name}
              </Text>
              {part.partNumber ? <Text style={styles.partNumber}>{part.partNumber}</Text> : null}
            </View>
          ))}
        </View>
      )}

      {entry.costCents !== undefined && <Text style={styles.cost}>{formatCents(entry.costCents)}</Text>}
    </View>
  );

  return (
    <View style={styles.row}>
      <View style={styles.axis}>
        {entry.odometer !== undefined ? (
          <>
            <Text style={styles.odometer}>{entry.odometer.toLocaleString('en-US')}</Text>
            <Text style={styles.odometerUnit}>mi</Text>
          </>
        ) : null}
      </View>

      <View style={styles.rail}>
        <View style={[styles.line, isLast && styles.lineToDot]} />
        <View style={[styles.dot, { borderColor: ink }]} />
      </View>

      <View style={styles.entry}>
        {onPress ? (
          <LiftPressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityHint="Opens this entry to edit it"
            style={(state) => [(state as PressState).focused && focusRing, styles.press]}
          >
            {card}
          </LiftPressable>
        ) : (
          card
        )}
      </View>
    </View>
  );
}

const AXIS = 56;
const RAIL = 28;
/** Vertical centre of an entry's first line, where its dot sits. */
const DOT_TOP = 21;

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },

  axis: { width: AXIS, alignItems: 'flex-end', paddingTop: 13 },
  // Barlow's tabular figures rather than the mono: the mono's comma is a
  // full cell wide and splits "58,210" into two numbers.
  odometer: {
    fontFamily: fonts.bodySemi,
    fontSize: type.compact.fontSize,
    lineHeight: 18,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  odometerUnit: { ...type.caption, color: colors.textFaint },

  rail: { width: RAIL, alignItems: 'center' },
  line: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.border,
  },
  lineFromMarker: { top: DOT_TOP },
  lineToMarker: { bottom: undefined, height: DOT_TOP },
  lineToDot: { bottom: undefined, height: DOT_TOP },
  dot: {
    marginTop: DOT_TOP - 6,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
    backgroundColor: colors.background,
  },
  // A change of chapter is a milestone in the car's life: the same ink and
  // size as the sale's marker on the front page, never foil.
  chapterMarker: {
    marginTop: DOT_TOP - 6,
    width: 12,
    height: 12,
    backgroundColor: KIND_COLORS.milestone,
    transform: [{ rotate: '45deg' }],
  },

  chapterText: { flex: 1, paddingTop: 5, paddingBottom: 14, paddingLeft: 6 },
  chapterTitle: { ...type.title, color: colors.text },
  chapterSubtitle: { ...type.small, color: colors.textMuted, marginTop: 4 },
  chapterNote: { ...type.small, color: colors.textFaint, marginTop: 2 },
  chapterEmpty: { ...type.small, color: colors.textFaint, marginTop: 12 },

  entry: { flex: 1, marginBottom: 14, paddingLeft: 4 },
  press: { borderRadius: radius.page },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.page,
    paddingVertical: 16,
    paddingHorizontal: 18,
    overflow: 'hidden',
  },

  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kindDot: { width: 8, height: 8, borderRadius: 4 },
  kind: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 18 },
  date: { ...type.caption, color: colors.inkMuted },

  title: { fontFamily: fonts.displayBold, fontSize: 26, lineHeight: 28, color: colors.ink, marginTop: 8 },
  notes: { fontFamily: fonts.body, fontSize: type.compact.fontSize, lineHeight: 22, color: colors.inkMuted, marginTop: 6 },

  photos: { marginTop: 14 },
  photoRow: { flexDirection: 'row', gap: 8 },
  photo: {
    width: 168,
    height: 120,
    borderRadius: radius.photo,
    backgroundColor: colors.paperShade,
  },

  parts: { marginTop: 14, borderTopWidth: 1, borderTopColor: colors.paperLine },
  partRow: { paddingVertical: 9 },
  partRowRule: { borderTopWidth: 1, borderTopColor: colors.paperLine },
  partName: { ...type.small, color: colors.inkMuted },
  partBrand: { fontFamily: fonts.bodySemi, color: colors.ink },
  partNumber: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 16, color: colors.inkMuted, marginTop: 2 },

  cost: { fontFamily: fonts.bodySemi, fontSize: 17, color: colors.ink, marginTop: 12, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
