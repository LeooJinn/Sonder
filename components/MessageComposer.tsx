import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  loadCarCard,
  loadShareableCars,
  MAX_MESSAGE_LENGTH,
  type MessageCar,
  type ShareableCar,
} from '../lib/messages';
import { describeError } from '../lib/errors';
import { colors, fonts, radius, type } from '../lib/theme';
import { Button, focusRing, noOutline, type PressState } from './ui';

// The field starts at one line and grows to six, then scrolls. Native reports
// the text's height; the web's textarea only ever reports its own box, so
// there it's measured by collapsing it and reading what the text needs.
// `rows` is real on the web and missing from React Native's types.
const WEB_ONE_ROW = { rows: 1 } as Record<string, unknown>;
const FIELD_PADDING = 26;
const FIELD_MIN = 52;
const FIELD_MAX = 164;

const carName = (car: ShareableCar | MessageCar) =>
  [car.vehicle.year, car.vehicle.make, car.vehicle.model].filter(Boolean).join(' ');

/**
 * Where a message is written. Text, and optionally one car: the member's own
 * published cars first, then cars they follow. Picking a car is inline, in a
 * short list above the field, because a sheet over the conversation would hide
 * the thing being answered.
 *
 * Send is the screen's one foil button. Enter sends on the web and Shift+Enter
 * starts a new line; on a phone the keyboard's return key is a new line, as in
 * every message field people already know.
 */
export function MessageComposer({ onSend }: { onSend: (body: string, car?: MessageCar) => Promise<void> }) {
  const [text, setText] = useState('');
  const [car, setCar] = useState<MessageCar | null>(null);
  const [choices, setChoices] = useState<ShareableCar[] | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [focused, setFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [height, setHeight] = useState(FIELD_MIN);

  const input = useRef<TextInput>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = input.current as unknown as HTMLTextAreaElement | null;
    if (!node?.style) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(FIELD_MAX, Math.max(FIELD_MIN, node.scrollHeight))}px`;
  }, [text]);

  const ready = text.trim().length > 0 && !sending;

  async function send() {
    if (!ready) return;
    setSending(true);
    setError(null);
    try {
      await onSend(text, car ?? undefined);
      setText('');
      setHeight(FIELD_MIN);
      setCar(null);
      setChoosing(false);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSending(false);
    }
  }

  async function toggleChoices() {
    if (choosing) {
      setChoosing(false);
      return;
    }
    setChoosing(true);
    if (choices) return;
    try {
      setChoices(await loadShareableCars());
    } catch {
      setChoices([]);
    }
  }

  async function pick(choice: ShareableCar) {
    setChoosing(false);
    // Show the car at once from what's known; the photo arrives a moment later.
    setCar({ vehicleId: choice.vehicleId, vehicle: choice.vehicle });
    try {
      setCar(await loadCarCard(choice));
    } catch {
      // The card works without its photo.
    }
  }

  return (
    <View style={styles.wrap}>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      {choosing ? (
        <View style={styles.choices}>
          {choices === null ? (
            <ActivityIndicator color={colors.accent} style={styles.choicesLoading} />
          ) : choices.length === 0 ? (
            <Text style={styles.noCars}>
              No cars to attach yet. Publish one of yours, or follow a car, and it shows up here.
            </Text>
          ) : (
            <ScrollView style={styles.choiceList} keyboardShouldPersistTaps="handled">
              {choices.map((choice) => (
                <Pressable
                  key={choice.vehicleId}
                  onPress={() => pick(choice)}
                  accessibilityRole="button"
                  accessibilityLabel={`Attach ${carName(choice)}`}
                  style={(state) => {
                    const { pressed, focused: f } = state as PressState;
                    return [styles.choice, pressed && styles.choicePressed, f && focusRing];
                  }}
                >
                  <Text style={styles.choiceName} numberOfLines={1}>
                    {carName(choice)}
                  </Text>
                  <Text style={styles.choiceTag}>{choice.mine ? 'Yours' : 'Following'}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}

      {car ? (
        <View style={styles.attached}>
          <View style={styles.attachedText}>
            <Text style={styles.attachedLabel}>Attached</Text>
            <Text style={styles.attachedName} numberOfLines={1}>
              {carName(car)}
            </Text>
          </View>
          <Pressable
            onPress={() => setCar(null)}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${carName(car)}`}
            style={(state) => [styles.remove, (state as PressState).focused && focusRing]}
          >
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.attach}>
          <Button
            label={choosing ? 'Cancel' : 'Attach a car'}
            variant="subtle"
            onPress={toggleChoices}
            accessibilityHint="Adds a link to one of your published cars, or a car you follow"
          />
        </View>
      )}

      <View style={styles.row}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Write a message"
          placeholderTextColor={colors.textFaint}
          multiline
          maxLength={MAX_MESSAGE_LENGTH}
          {...WEB_ONE_ROW}
          ref={input}
          onContentSizeChange={(e) =>
            setHeight(Math.min(FIELD_MAX, Math.max(FIELD_MIN, Math.ceil(e.nativeEvent.contentSize.height) + FIELD_PADDING)))
          }
          accessibilityLabel="Message"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyPress={(e) => {
            if (Platform.OS !== 'web') return;
            const key = e.nativeEvent as unknown as { key: string; shiftKey?: boolean };
            if (key.key === 'Enter' && !key.shiftKey) {
              (e as unknown as { preventDefault: () => void }).preventDefault();
              send();
            }
          }}
          style={[styles.input, noOutline, Platform.OS !== 'web' && { height }, focused && styles.inputFocused]}
        />
        <Button label="Send" onPress={send} busy={sending} disabled={!ready} style={styles.send} />
      </View>
      {text.length > MAX_MESSAGE_LENGTH - 200 ? (
        <Text style={styles.count}>
          {text.length} of {MAX_MESSAGE_LENGTH}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  input: {
    ...type.body,
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  inputFocused: { borderColor: colors.accent },
  send: { paddingHorizontal: 22 },
  count: { ...type.caption, color: colors.textFaint, textAlign: 'right' },
  error: { ...type.small, color: colors.danger },

  attach: { alignItems: 'flex-start' },
  attached: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.paper,
    borderRadius: radius.control,
    paddingLeft: 14,
    minHeight: 48,
  },
  attachedText: { flex: 1, paddingVertical: 6 },
  attachedLabel: { ...type.caption, color: colors.inkMuted },
  attachedName: { fontFamily: fonts.bodySemi, fontSize: type.compact.fontSize, lineHeight: 20, color: colors.ink },
  remove: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: radius.control },
  removeText: { fontFamily: fonts.bodySemi, fontSize: type.compact.fontSize, color: colors.inkMuted },

  choices: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.control, overflow: 'hidden' },
  choiceList: { maxHeight: 188 },
  choicesLoading: { paddingVertical: 20 },
  noCars: { ...type.small, color: colors.textMuted, padding: 14 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  choicePressed: { backgroundColor: colors.surface },
  choiceName: { ...type.compact, flex: 1, color: colors.text },
  choiceTag: { ...type.caption, color: colors.textFaint },
});
