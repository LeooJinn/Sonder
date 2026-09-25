import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ENTRY_KINDS, KIND_LABELS, parseCents, type EntryKind, type Part } from '../lib/log';
import { today } from '../lib/dates';
import { pickImages, type Photo } from '../lib/photos';
import { Button, Field, Notice, focusRing, type PressState } from './ui';
import { colors, column, fonts, KIND_COLORS, radius, type } from '../lib/theme';

/**
 * Everything the form collects. Deliberately not a LogEntry: the form knows
 * nothing about which vehicle it belongs to, or about ids and timestamps.
 * The screen using it supplies those.
 */
export type EntryFormValues = {
  kind: EntryKind;
  title: string;
  occurredOn: string;
  notes?: string;
  odometer?: number;
  costCents?: number;
  parts: Part[];
  /**
   * Local device URIs chosen but not yet uploaded. The form can't upload them
   * itself, because a new entry has no id to attach them to until it's saved.
   * The screen does it afterwards.
   */
  newPhotoUris: string[];
  /** Ids of already-uploaded photos the user removed. Deleted on save. */
  removedPhotoIds: string[];
};

const emptyPart = (): Part => ({ brand: '', name: '' });

/** Cents back to an editable string: 45000 -> "450", 45050 -> "450.5". */
function centsToInput(cents: number | undefined): string {
  return cents === undefined ? '' : String(cents / 100);
}

export function EntryForm({
  initial,
  initialPhotos,
  submitLabel,
  onSubmit,
}: {
  /** Pre-filled values when editing. Omitted when creating. */
  initial?: EntryFormValues;
  /** Photos already uploaded against this entry. Editing only. */
  initialPhotos?: Photo[];
  submitLabel: string;
  onSubmit: (values: EntryFormValues) => Promise<void>;
}) {
  const [kind, setKind] = useState<EntryKind>(initial?.kind ?? 'mod');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [occurredOn, setOccurredOn] = useState(initial?.occurredOn ?? today());
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [odometer, setOdometer] = useState(
    initial?.odometer !== undefined ? String(initial.odometer) : ''
  );
  const [cost, setCost] = useState(centsToInput(initial?.costCents));
  const [parts, setParts] = useState<Part[]>(initial?.parts ?? []);
  const [existingPhotos, setExistingPhotos] = useState<Photo[]>(initialPhotos ?? []);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [newPhotoUris, setNewPhotoUris] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handlePickPhotos() {
    setError(null);
    try {
      const uris = await pickImages();
      setNewPhotoUris((current) => [...current, ...uris]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open your photo library.');
    }
  }

  /** Removal is staged, not immediate — nothing is deleted until save. */
  function removeExistingPhoto(id: string) {
    setExistingPhotos((current) => current.filter((photo) => photo.id !== id));
    setRemovedPhotoIds((current) => [...current, id]);
  }

  /**
   * State is replaced, not mutated: build a new array containing a new object
   * for the row that changed. Assigning to parts[index].brand would update the
   * value but leave the array reference identical, so React would not re-render.
   */
  function updatePart(index: number, patch: Partial<Part>) {
    setParts((current) => current.map((part, i) => (i === index ? { ...part, ...patch } : part)));
  }

  async function handleSubmit() {
    setError(null);

    if (!title.trim()) {
      setError('Give the entry a title.');
      return;
    }
    if (!isValidDate(occurredOn)) {
      setError('Enter a real date in YYYY-MM-DD format.');
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        kind,
        title: title.trim(),
        occurredOn,
        notes: notes.trim() || undefined,
        odometer: odometer.trim() ? Number(odometer.replace(/[^\d]/g, '')) : undefined,
        costCents: parseCents(cost),
        // Drop rows the user started but left blank.
        parts: parts
          .filter((p) => p.brand.trim() || p.name.trim())
          .map((p) => ({
            brand: p.brand.trim(),
            name: p.name.trim(),
            partNumber: p.partNumber?.trim() || undefined,
            costCents: p.costCents,
          })),
        newPhotoUris,
        removedPhotoIds,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that entry.');
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>What happened</Text>
        <View style={styles.kinds} accessibilityRole="radiogroup">
          {ENTRY_KINDS.map((option) => {
            const selected = kind === option;
            const ink = KIND_COLORS[option];
            return (
              <Pressable
                key={option}
                onPress={() => setKind(option)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={(state) => [
                  styles.kind,
                  selected && { borderColor: ink, backgroundColor: colors.surface },
                  (state as PressState).focused && focusRing,
                ]}
              >
                <View style={[styles.kindDot, { borderColor: ink }, selected && { backgroundColor: ink }]} />
                <Text style={[styles.kindText, selected && styles.kindTextSelected]}>
                  {KIND_LABELS[option]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Field label="Title" value={title} onChangeText={setTitle} placeholder="Installed coilovers" />

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Field
              label="Date"
              value={occurredOn}
              onChangeText={setOccurredOn}
              placeholder="YYYY-MM-DD"
              hint="Year, month, day"
              isMono
              autoCorrect={false}
            />
          </View>
          <View style={styles.rowItem}>
            <Field
              label="Odometer, miles"
              value={odometer}
              onChangeText={setOdometer}
              placeholder="52000"
              keyboardType="numeric"
              isMono
            />
          </View>
        </View>

        <Field
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="What was done, and what the next person should watch out for"
          multiline
        />

        <Field
          label="Total cost"
          value={cost}
          onChangeText={setCost}
          placeholder="450.00"
          keyboardType="decimal-pad"
          hint="Optional. Shown on the passport if you publish it."
        />

        <View style={styles.subsection}>
          <View style={styles.subsectionHeader}>
            <Text style={styles.subsectionTitle}>Photos</Text>
            <Button label="Add photos" variant="quiet" onPress={handlePickPhotos} />
          </View>

          {existingPhotos.length === 0 && newPhotoUris.length === 0 ? (
            <Text style={styles.none}>Before and after shots help the next owner most.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.photoRow}>
                {existingPhotos.map((photo) => (
                  <Thumb
                    key={photo.id}
                    uri={photo.url}
                    onRemove={() => removeExistingPhoto(photo.id)}
                  />
                ))}
                {newPhotoUris.map((uri, index) => (
                  <Thumb
                    key={`${uri}-${index}`}
                    uri={uri}
                    isNew
                    onRemove={() =>
                      setNewPhotoUris((current) => current.filter((_, i) => i !== index))
                    }
                  />
                ))}
              </View>
            </ScrollView>
          )}
        </View>

        <View style={styles.subsection}>
          <View style={styles.subsectionHeader}>
            <Text style={styles.subsectionTitle}>Parts</Text>
            <Button
              label="Add a part"
              variant="quiet"
              onPress={() => setParts((current) => [...current, emptyPart()])}
            />
          </View>

          {parts.length === 0 ? (
            <Text style={styles.none}>
              Brand and part number make it searchable for the next owner.
            </Text>
          ) : (
            parts.map((part, index) => (
              <View key={index} style={styles.part}>
                <View style={styles.partHeader}>
                  <Text style={styles.partIndex}>Part {index + 1}</Text>
                  <Button
                    label="Remove"
                    variant="quiet"
                    onPress={() => setParts((current) => current.filter((_, i) => i !== index))}
                  />
                </View>

                <Field
                  label="Part"
                  value={part.name}
                  onChangeText={(v) => updatePart(index, { name: v })}
                  placeholder="500 Series coilovers"
                />

                <View style={styles.row}>
                  <View style={styles.rowItem}>
                    <Field
                      label="Brand"
                      value={part.brand}
                      onChangeText={(v) => updatePart(index, { brand: v })}
                      placeholder="Fortune Auto"
                    />
                  </View>
                  <View style={styles.rowItem}>
                    <Field
                      label="Cost"
                      value={centsToInput(part.costCents)}
                      onChangeText={(v) => updatePart(index, { costCents: parseCents(v) })}
                      placeholder="Optional"
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>

                <Field
                  label="Part number"
                  value={part.partNumber ?? ''}
                  onChangeText={(v) => updatePart(index, { partNumber: v })}
                  placeholder="Optional"
                  autoCorrect={false}
                  isMono
                />
              </View>
            ))
          )}
        </View>

        {error && <Notice tone="error">{error}</Notice>}

        <Button label={submitLabel} onPress={handleSubmit} busy={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** A photo on the entry, with a way to take it off again. */
function Thumb({ uri, isNew, onRemove }: { uri: string; isNew?: boolean; onRemove: () => void }) {
  return (
    <View style={styles.thumbWrap}>
      <Image source={{ uri }} style={styles.thumb} />
      {isNew ? (
        <View style={styles.thumbBadge}>
          <Text style={styles.thumbBadgeText}>Not saved yet</Text>
        </View>
      ) : null}
      <Pressable
        style={styles.thumbRemove}
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel="Remove photo"
        hitSlop={6}
      >
        <Text style={styles.thumbRemoveText}>×</Text>
      </Pressable>
    </View>
  );
}

/**
 * Checks the date is real, not just well-shaped. Date parses 2026-02-31 as
 * 3 March, so we round-trip it and confirm we got the same string back —
 * which catches both impossible days and impossible months.
 */
function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 56, ...column },

  label: { ...type.label, color: colors.textMuted, marginBottom: 8 },

  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  kind: {
    flexGrow: 1,
    flexBasis: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
  },
  kindDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  kindText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.textMuted },
  kindTextSelected: { fontFamily: fonts.bodySemi, color: colors.text },

  row: { flexDirection: 'row', gap: 12 },
  rowItem: { flex: 1 },

  subsection: {
    marginTop: 8,
    marginBottom: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  subsectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  subsectionTitle: { ...type.heading, color: colors.text },
  none: { ...type.small, color: colors.textFaint },

  photoRow: { flexDirection: 'row', gap: 12, paddingTop: 8, paddingRight: 8 },
  thumbWrap: { width: 104, height: 104 },
  thumb: { width: 104, height: 104, borderRadius: radius.photo, backgroundColor: colors.surface },
  thumbRemove: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbRemoveText: { color: colors.ink, fontSize: 18, lineHeight: 20, fontFamily: fonts.bodySemi },
  thumbBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: colors.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  thumbBadgeText: { ...type.caption, fontSize: 11, color: colors.accent },

  part: {
    backgroundColor: colors.surface,
    borderRadius: radius.control,
    padding: 14,
    paddingBottom: 0,
    marginBottom: 12,
  },
  partHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  partIndex: { ...type.label, color: colors.textMuted },
});
