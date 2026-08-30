import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  addEntry,
  ENTRY_KINDS,
  KIND_LABELS,
  parseCents,
  today,
  type EntryKind,
  type Part,
} from '../../../lib/log';
import { colors, mono } from '../../../lib/theme';

/** A blank part row. */
const emptyPart = (): Part => ({ brand: '', name: '' });

export default function AddEntryScreen() {
  const { vin } = useLocalSearchParams<{ vin: string }>();
  const router = useRouter();

  const [kind, setKind] = useState<EntryKind>('mod');
  const [title, setTitle] = useState('');
  const [occurredOn, setOccurredOn] = useState(today());
  const [notes, setNotes] = useState('');
  const [odometer, setOdometer] = useState('');
  const [cost, setCost] = useState('');
  const [parts, setParts] = useState<Part[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /**
   * State in React is replaced, not mutated. To change one field of one part
   * we build a new array containing a new object — mutating parts[i] directly
   * would not trigger a re-render, because the array reference wouldn't change.
   */
  function updatePart(index: number, patch: Partial<Part>) {
    setParts((current) => current.map((part, i) => (i === index ? { ...part, ...patch } : part)));
  }

  async function handleSave() {
    setError(null);

    if (!title.trim()) {
      setError('Give the entry a title.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) {
      setError('Date must be in YYYY-MM-DD format.');
      return;
    }

    // Drop part rows the user started but left blank.
    const filledParts = parts.filter((p) => p.brand.trim() || p.name.trim());

    setSaving(true);
    try {
      await addEntry({
        vehicleVin: vin,
        kind,
        title: title.trim(),
        occurredOn,
        notes: notes.trim() || undefined,
        odometer: odometer.trim() ? Number(odometer.replace(/[^\d]/g, '')) : undefined,
        costCents: parseCents(cost),
        parts: filledParts.map((p) => ({
          brand: p.brand.trim(),
          name: p.name.trim(),
          partNumber: p.partNumber?.trim() || undefined,
          costCents: p.costCents,
        })),
      });
      router.back();
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
      <Stack.Screen options={{ title: 'Add to log' }} />

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
                    value={part.costCents !== undefined ? String(part.costCents / 100) : ''}
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
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveText}>Save entry</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** One labelled text input. Extracted because this screen has eleven of them. */
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
