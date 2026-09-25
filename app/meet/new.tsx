import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { createMeet } from '../../lib/meets';
import { loadMyProfile } from '../../lib/profile';
import { localDateTimeToIso, nextWeekday } from '../../lib/dates';
import { describeError } from '../../lib/errors';
import { RegionPicker } from '../../components/RegionPicker';
import { Button, Field, Notice, focusRing, type PressState } from '../../components/ui';
import { colors, column, fonts, radius, type } from '../../lib/theme';

/** Most meets are weekend mornings. These fill the date in one tap. */
const QUICK_DATES = [
  { label: 'This Saturday', date: () => nextWeekday(6) },
  { label: 'This Sunday', date: () => nextWeekday(0) },
  { label: 'Next Saturday', date: () => nextWeekday(6, 1) },
];

export default function NewMeetScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');
  const [region, setRegion] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Most people post meets where they live.
  useEffect(() => {
    loadMyProfile()
      .then((profile) => setRegion((current) => current || profile.region || ''))
      .catch(() => {});
  }, []);

  async function handlePost() {
    setError(null);
    if (!title.trim()) return setError('Give the meet a name.');
    if (!place.trim()) return setError('Say where to meet.');
    if (!region) return setError("Choose the region it's in, so people nearby can find it.");

    const startsAt = localDateTimeToIso(date, time);
    if (!startsAt) return setError('Enter the date as YYYY-MM-DD and the time as HH:MM.');
    if (new Date(startsAt).getTime() < Date.now()) return setError('That time has already passed.');

    setSaving(true);
    try {
      const id = await createMeet({ title, place, region, startsAt, details });
      router.replace(`/meet/${id}`);
    } catch (e) {
      setError(describeError(e, 'The meet could not be posted. Try again.'));
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Post a meet' }} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field
          label="Name"
          value={title}
          onChangeText={setTitle}
          placeholder="Sunday coffee and cars"
          maxLength={80}
        />

        <Field
          label="Where"
          value={place}
          onChangeText={setPlace}
          placeholder="Griffith Observatory, lower lot"
          hint="A public place, like a car park or a coffee shop. Never a home address."
          maxLength={120}
        />

        <View style={styles.field}>
          <Text style={styles.label}>Region</Text>
          <RegionPicker value={region} onChange={setRegion} />
        </View>

        <Text style={styles.label}>When</Text>
        <View style={styles.quick}>
          {QUICK_DATES.map((option) => {
            const value = option.date();
            const selected = date === value;
            return (
              <Pressable
                key={option.label}
                onPress={() => setDate(value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={(state) => [
                  styles.chip,
                  selected && styles.chipSelected,
                  (state as PressState).focused && focusRing,
                ]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Field
              label="Date"
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              isMono
              autoCorrect={false}
            />
          </View>
          <View style={styles.rowItem}>
            <Field
              label="Starts at"
              value={time}
              onChangeText={setTime}
              placeholder="09:00"
              hint="24-hour clock"
              isMono
              autoCorrect={false}
            />
          </View>
        </View>

        <Field
          label="Details"
          value={details}
          onChangeText={setDetails}
          placeholder="Where to park, what to bring, anything people should know"
          multiline
          maxLength={2000}
        />

        {error && <Notice tone="error">{error}</Notice>}

        <Button label="Post meet" onPress={handlePost} busy={saving} />
        <Text style={styles.privacy}>
          Signed-in members can see this meet and who says they&apos;re going. It never appears
          on public pages.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 56, ...column },

  field: { marginBottom: 20 },
  label: { ...type.label, color: colors.textMuted, marginBottom: 8 },

  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { borderColor: colors.accent, backgroundColor: colors.surface },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textMuted },
  chipTextSelected: { color: colors.text },

  row: { flexDirection: 'row', gap: 12 },
  rowItem: { flex: 1 },

  privacy: { ...type.caption, color: colors.textFaint, marginTop: 12 },
});
