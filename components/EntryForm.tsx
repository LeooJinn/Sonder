import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ENTRY_KINDS, KIND_LABELS, parseCents, type EntryKind, type Part } from '../lib/log';
import { today } from '../lib/dates';
import { pickImages, type Photo } from '../lib/photos';
import { colors, mono } from '../lib/theme';

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
        <Text style={styles.label}>Kind</Text>
        <View style={styles.kinds}>
          {ENTRY_KINDS.map((option) => (
            <Pressable
              key={option}
              style={[styles.kindChip, kind === option && styles.kindChipActive]}
              onPress={() => setKind(option)}
            >
              <Text style={[styles.kindText, kind === option && styles.kindTextActive]}>
                {KIND_LABELS[option]}
              </Text>
            </Pressable>
          ))}
        </View>

        <Field label="Title" value={title} onChange={setTitle} placeholder="Installed coilovers" />
        <Field
          label="Date"
          value={occurredOn}
          onChange={setOccurredOn}
          placeholder="YYYY-MM-DD"
          isMono
        />
        <Field
          label="Notes"
          value={notes}
          onChange={setNotes}
          placeholder="What you did, what to watch out for"
          multiline
        />

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Field
              label="Odometer"
              value={odometer}
              onChange={setOdometer}
              placeholder="52000"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.rowItem}>
            <Field
              label="Cost"
              value={cost}
              onChange={setCost}
              placeholder="450.00"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.partsHeader}>
          <Text style={styles.label}>Photos</Text>
          <Pressable onPress={handlePickPhotos}>
            <Text style={styles.addPart}>+ Add photos</Text>
          </Pressable>
        </View>

        {existingPhotos.length === 0 && newPhotoUris.length === 0 ? (
          <Text style={styles.noParts}>No photos on this entry.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
            <View style={styles.photoRow}>
              {existingPhotos.map((photo) => (
                <View key={photo.id} style={styles.thumbWrap}>
                  <Image source={{ uri: photo.url }} style={styles.thumb} />
                  <Pressable style={styles.thumbRemove} onPress={() => removeExistingPhoto(photo.id)}>
                    <Text style={styles.thumbRemoveText}>×</Text>
                  </Pressable>
                </View>
              ))}
              {newPhotoUris.map((uri, index) => (
                <View key={`${uri}-${index}`} style={styles.thumbWrap}>
                  <Image source={{ uri }} style={styles.thumb} />
                  <View style={styles.thumbBadge}>
                    <Text style={styles.thumbBadgeText}>NEW</Text>
                  </View>
                  <Pressable
                    style={styles.thumbRemove}
                    onPress={() =>
                      setNewPhotoUris((current) => current.filter((_, i) => i !== index))
                    }
                  >
                    <Text style={styles.thumbRemoveText}>×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </ScrollView>
        )}

        <View style={styles.partsHeader}>
          <Text style={styles.label}>Parts</Text>
          <Pressable onPress={() => setParts((current) => [...current, emptyPart()])}>
            <Text style={styles.addPart}>+ Add part</Text>
          </Pressable>
        </View>

        {parts.length === 0 ? (
          <Text style={styles.noParts}>No parts on this entry.</Text>
        ) : (
          parts.map((part, index) => (
            <View key={index} style={styles.partBlock}>
              <View style={styles.partBlockHeader}>
                <Text style={styles.partIndex}>Part {index + 1}</Text>
                <Pressable
                  onPress={() => setParts((current) => current.filter((_, i) => i !== index))}
                >
                  <Text style={styles.removePart}>Remove</Text>
                </Pressable>
              </View>

              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <Field
                    label="Brand"
                    value={part.brand}
                    onChange={(v) => updatePart(index, { brand: v })}
                    placeholder="Fortune Auto"
                  />
                </View>
                <View style={styles.rowItem}>
                  <Field
                    label="Part"
                    value={part.name}
                    onChange={(v) => updatePart(index, { name: v })}
                    placeholder="500 Series"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <Field
                    label="Part number"
                    value={part.partNumber ?? ''}
                    onChange={(v) => updatePart(index, { partNumber: v })}
                    placeholder="optional"
                    isMono
                  />
                </View>
                <View style={styles.rowItem}>
                  <Field
                    label="Cost"
                    value={centsToInput(part.costCents)}
                    onChange={(v) => updatePart(index, { costCents: parseCents(v) })}
                    placeholder="optional"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>
          ))
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={({ pressed }) => [
            styles.save,
            pressed && styles.savePressed,
            saving && styles.saveDisabled,
          ]}
          onPress={handleSubmit}
          disabled={saving}
        >
          <Text style={styles.saveText}>{submitLabel}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
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

/** One labelled text input. Extracted because this form has eleven of them. */
function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  isMono,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  isMono?: boolean;
  keyboardType?: 'numeric' | 'decimal-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline, isMono && styles.inputMono]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.disabled}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCorrect={!isMono}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 48 },

  label: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },

  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  kindChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  kindChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  kindText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  kindTextActive: { color: colors.background },

  field: { marginBottom: 18 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    color: colors.text,
    fontSize: 15,
    padding: 12,
  },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top' },
  inputMono: { fontFamily: mono, letterSpacing: 1 },

  row: { flexDirection: 'row', gap: 12 },
  rowItem: { flex: 1 },

  partsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  addPart: { color: colors.accent, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  noParts: { color: colors.textFaint, fontSize: 14, marginBottom: 8 },

  photoStrip: { marginBottom: 12 },
  photoRow: { flexDirection: 'row', gap: 10 },
  thumbWrap: { width: 96, height: 96 },
  thumb: {
    width: 96,
    height: 96,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbRemoveText: {
    color: colors.background,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 20,
  },
  thumbBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: colors.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  thumbBadgeText: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },

  partBlock: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 14,
    marginBottom: 12,
  },
  partBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  partIndex: {
    color: colors.textFaint,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  removePart: { color: colors.accent, fontSize: 12, fontWeight: '600' },

  error: { color: colors.accent, fontSize: 14, marginBottom: 16, lineHeight: 20 },

  save: {
    backgroundColor: colors.accent,
    borderRadius: 4,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  savePressed: { opacity: 0.8 },
  saveDisabled: { backgroundColor: colors.disabled },
  saveText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
