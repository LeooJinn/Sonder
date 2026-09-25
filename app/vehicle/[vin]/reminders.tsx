import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  addReminder,
  deleteReminder,
  knownMileage,
  lastMatchingEntry,
  loadReminders,
  PRESETS,
  reminderStatus,
  updateReminder,
  type NewReminder,
  type Reminder,
} from '../../../lib/reminders';
import { loadEntries, type LogEntry } from '../../../lib/log';
import { formatDay } from '../../../lib/dates';
import { describeError } from '../../../lib/errors';
import { STATE_COLORS } from '../../../components/Reminders';
import { Button, ErrorState, Field, Notice, SectionHeader, focusRing, type PressState } from '../../../components/ui';
import { colors, column, fonts, radius, type } from '../../../lib/theme';

/** What the form edits: numbers as the strings being typed. */
type Draft = {
  id?: string;
  title: string;
  everyMiles: string;
  everyMonths: string;
  lastDoneOn: string;
  lastDoneOdometer: string;
  /** Where "last done" came from, when it was filled in from the log. */
  foundIn?: string;
};

const blank: Draft = { title: '', everyMiles: '', everyMonths: '', lastDoneOn: '', lastDoneOdometer: '' };

function toDraft(r: Reminder): Draft {
  return {
    id: r.id,
    title: r.title,
    everyMiles: r.everyMiles?.toString() ?? '',
    everyMonths: r.everyMonths?.toString() ?? '',
    lastDoneOn: r.lastDoneOn ?? '',
    lastDoneOdometer: r.lastDoneOdometer?.toString() ?? '',
  };
}

function whole(text: string): number | undefined {
  const digits = text.replace(/[^\d]/g, '');
  return digits ? Number(digits) : undefined;
}

/** A car's reminders: add them from common jobs, change their intervals, or remove them. */
export default function RemindersScreen() {
  const { vin } = useLocalSearchParams<{ vin: string }>();
  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setError(null);
    Promise.all([loadReminders(vin), loadEntries(vin)])
      .then(([found, log]) => {
        setReminders(found);
        setEntries(log);
      })
      .catch((e) => setError(describeError(e)));
  }, [vin]);

  useFocusEffect(load);

  /** Start from a common job, with "last done" found in the log if it's there. */
  function startPreset(preset: (typeof PRESETS)[number]) {
    const match = lastMatchingEntry(entries, preset.matches);
    setFormError(null);
    setDraft({
      title: preset.title,
      everyMiles: preset.everyMiles?.toString() ?? '',
      everyMonths: preset.everyMonths?.toString() ?? '',
      lastDoneOn: match?.occurredOn ?? '',
      lastDoneOdometer: match?.odometer?.toString() ?? '',
      foundIn: match ? `"${match.title}" on ${formatDay(match.occurredOn)}` : undefined,
    });
  }

  async function save() {
    if (!draft) return;
    setFormError(null);

    const reminder: NewReminder = {
      title: draft.title.trim(),
      everyMiles: whole(draft.everyMiles),
      everyMonths: whole(draft.everyMonths),
      lastDoneOn: draft.lastDoneOn.trim() || undefined,
      lastDoneOdometer: whole(draft.lastDoneOdometer),
    };
    if (!reminder.title) return setFormError('Say what the reminder is for.');
    if (!reminder.everyMiles && !reminder.everyMonths) {
      return setFormError('Give it an interval in miles, months, or both.');
    }
    if (reminder.everyMonths && reminder.everyMonths > 240) {
      return setFormError('Keep the interval under 20 years.');
    }
    if (reminder.lastDoneOn && !/^\d{4}-\d{2}-\d{2}$/.test(reminder.lastDoneOn)) {
      return setFormError('Enter the date it was last done as YYYY-MM-DD.');
    }

    setSaving(true);
    try {
      if (draft.id) {
        await updateReminder(draft.id, reminder);
      } else {
        await addReminder(vin, reminder);
      }
      setDraft(null);
      load();
    } catch (e) {
      setFormError(describeError(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setSaving(true);
    try {
      await deleteReminder(id);
      setDraft(null);
      load();
    } catch (e) {
      setFormError(describeError(e));
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Reminders' }} />
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  if (!reminders) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Stack.Screen options={{ title: 'Reminders' }} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const mileage = knownMileage(entries, reminders);
  const unused = PRESETS.filter((p) => !reminders.some((r) => r.title.toLowerCase() === p.title.toLowerCase()));

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Reminders' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          Each reminder is due at whichever comes first, the miles or the months. When you log the
          work, tick it off in the entry and the clock resets.
        </Text>

        {reminders.length > 0 && (
          <View style={styles.section}>
            {reminders.map((reminder) => {
              const status = reminderStatus(reminder, mileage);
              const editing = draft?.id === reminder.id;
              return (
                <View key={reminder.id}>
                  <Pressable
                    onPress={() => {
                      setFormError(null);
                      setDraft(editing ? null : toDraft(reminder));
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: editing }}
                    style={(state) => [
                      styles.row,
                      editing && styles.rowOpen,
                      (state as PressState).focused && focusRing,
                    ]}
                  >
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle}>{reminder.title}</Text>
                      <Text style={styles.rowInterval}>
                        Every{' '}
                        {[
                          reminder.everyMiles ? `${reminder.everyMiles.toLocaleString('en-US')} mi` : '',
                          reminder.everyMonths
                            ? `${reminder.everyMonths} ${reminder.everyMonths === 1 ? 'month' : 'months'}`
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' or ')}
                        {reminder.lastDoneOn
                          ? `. Last done ${formatDay(reminder.lastDoneOn)}.`
                          : reminder.lastDoneOdometer !== undefined
                            ? `. Last done at ${reminder.lastDoneOdometer.toLocaleString('en-US')} mi.`
                            : '.'}
                      </Text>
                    </View>
                    <Text style={[styles.rowStatus, { color: STATE_COLORS[status.state] }]}>
                      {status.text}
                    </Text>
                  </Pressable>
                  {editing && (
                    <ReminderForm
                      draft={draft!}
                      onChange={setDraft}
                      onSave={save}
                      onDelete={() => remove(reminder.id)}
                      saving={saving}
                      error={formError}
                    />
                  )}
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.section}>
          <SectionHeader title="Add a reminder" />
          {draft && !draft.id ? (
            <ReminderForm
              draft={draft}
              onChange={setDraft}
              onSave={save}
              onCancel={() => setDraft(null)}
              saving={saving}
              error={formError}
            />
          ) : (
            <View style={styles.presets}>
              {unused.map((preset) => (
                <Pressable
                  key={preset.title}
                  onPress={() => startPreset(preset)}
                  accessibilityRole="button"
                  style={(state) => [styles.chip, (state as PressState).focused && focusRing]}
                >
                  <Text style={styles.chipText}>{preset.title}</Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => {
                  setFormError(null);
                  setDraft({ ...blank });
                }}
                accessibilityRole="button"
                style={(state) => [styles.chip, styles.chipCustom, (state as PressState).focused && focusRing]}
              >
                <Text style={[styles.chipText, styles.chipCustomText]}>Something else</Text>
              </Pressable>
            </View>
          )}
          <Text style={styles.note}>
            Intervals are typical starting points. The right ones are in your car&apos;s manual.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ReminderForm({
  draft,
  onChange,
  onSave,
  onCancel,
  onDelete,
  saving,
  error,
}: {
  draft: Draft;
  onChange: (draft: Draft) => void;
  onSave: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  saving: boolean;
  error: string | null;
}) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });

  return (
    <View style={styles.form}>
      <Field label="For" value={draft.title} onChangeText={(title) => set({ title })} placeholder="Oil change" maxLength={60} />
      <View style={styles.pair}>
        <View style={styles.pairItem}>
          <Field
            label="Every, miles"
            value={draft.everyMiles}
            onChangeText={(everyMiles) => set({ everyMiles })}
            placeholder="5000"
            keyboardType="numeric"
          />
        </View>
        <View style={styles.pairItem}>
          <Field
            label="Every, months"
            value={draft.everyMonths}
            onChangeText={(everyMonths) => set({ everyMonths })}
            placeholder="6"
            keyboardType="numeric"
          />
        </View>
      </View>
      <View style={styles.pair}>
        <View style={styles.pairItem}>
          <Field
            label="Last done"
            value={draft.lastDoneOn}
            onChangeText={(lastDoneOn) => set({ lastDoneOn, foundIn: undefined })}
            placeholder="YYYY-MM-DD"
            isMono
            autoCorrect={false}
          />
        </View>
        <View style={styles.pairItem}>
          <Field
            label="At, miles"
            value={draft.lastDoneOdometer}
            onChangeText={(lastDoneOdometer) => set({ lastDoneOdometer, foundIn: undefined })}
            placeholder="52000"
            keyboardType="numeric"
          />
        </View>
      </View>
      {draft.foundIn ? (
        <Text style={styles.found}>Filled in from your log: {draft.foundIn}.</Text>
      ) : null}
      {error && <Notice tone="error">{error}</Notice>}
      <View style={styles.formActions}>
        <Button label={draft.id ? 'Save' : 'Add reminder'} variant="secondary" busy={saving} onPress={onSave} style={styles.formButton} />
        {onCancel && <Button label="Cancel" variant="quiet" onPress={onCancel} />}
        {onDelete && <Button label="Remove" variant="quiet" onPress={onDelete} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 56, ...column },

  intro: { ...type.body, color: colors.textMuted },
  section: { marginTop: 28 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowOpen: { borderBottomColor: 'transparent' },
  rowText: { flex: 1 },
  rowTitle: { ...type.bodyStrong, color: colors.text },
  rowInterval: { ...type.small, color: colors.textFaint, marginTop: 2 },
  rowStatus: { fontFamily: fonts.bodyMedium, fontSize: 14, textAlign: 'right', maxWidth: '45%' },

  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 42,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  chipCustom: { borderStyle: 'dashed' },
  chipCustomText: { color: colors.textMuted },
  note: { ...type.caption, color: colors.textFaint, marginTop: 14 },

  form: {
    backgroundColor: colors.surface,
    borderRadius: radius.control,
    padding: 14,
    paddingBottom: 16,
    marginTop: 4,
    marginBottom: 12,
  },
  pair: { flexDirection: 'row', gap: 12 },
  pairItem: { flex: 1 },
  found: { ...type.small, color: colors.accent, marginTop: -8, marginBottom: 14 },
  formActions: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  formButton: { minHeight: 44 },
});
