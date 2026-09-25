import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius, type } from '../lib/theme';
import { noOutline } from './ui';

/**
 * A VIN is three things run together: who made the car, what it is, and which
 * one it is. Showing the 17 characters in those groups makes a typo findable,
 * and a counter unnecessary — the empty boxes are the count.
 */
const GROUPS = [
  { label: 'Maker', start: 0, length: 3 },
  { label: 'Model and engine', start: 3, length: 6 },
  { label: 'Serial', start: 9, length: 8 },
];

/**
 * I, O and Q never appear in a VIN because they're too easily read as 1 and
 * 0. Anything else outside A–Z and 0–9 is just noise from pasting.
 */
const NOT_IN_VINS = /[IOQ]/g;

export function VinInput({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (vin: string) => void;
  onSubmit?: () => void;
}) {
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const [rejected, setRejected] = useState(false);

  function handleChange(text: string) {
    const upper = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cleaned = upper.replace(NOT_IN_VINS, '');
    setRejected(cleaned.length !== upper.length);
    onChange(cleaned.slice(0, 17));
  }

  return (
    <View>
      <Pressable
        onPress={() => input.current?.focus()}
        style={styles.boxes}
        accessible={false}
      >
        {GROUPS.map((group) => (
          <View key={group.label} style={{ flex: group.length }}>
            <View style={styles.group}>
              {Array.from({ length: group.length }, (_, i) => {
                const index = group.start + i;
                const char = value[index];
                const isCursor = focused && index === Math.min(value.length, 16);
                return (
                  <View
                    key={index}
                    style={[styles.cell, char ? styles.cellFilled : null, isCursor && styles.cellCursor]}
                  >
                    <Text style={styles.char}>{char ?? ''}</Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.groupLabel} numberOfLines={1}>
              {group.label}
            </Text>
          </View>
        ))}

        {/* The real input sits over the boxes, invisible, so typing, pasting,
            autofill and the keyboard all behave exactly as they normally do. */}
        <TextInput
          ref={input}
          value={value}
          onChangeText={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmit}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          maxLength={24}
          caretHidden
          accessibilityLabel="Vehicle identification number, 17 characters"
          style={[styles.hiddenInput, noOutline]}
        />
      </Pressable>

      {rejected ? (
        <Text style={styles.warning} accessibilityLiveRegion="polite">
          VINs never use the letters I, O or Q. Try the number 1 or 0 instead.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  boxes: { flexDirection: 'row', gap: 8 },
  group: { flexDirection: 'row', gap: 2 },
  cell: {
    flex: 1,
    height: 48,
    borderRadius: radius.photo,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellFilled: { borderColor: colors.border },
  cellCursor: { borderColor: colors.accent },
  char: { fontFamily: fonts.mono, fontSize: 16, color: colors.text },
  groupLabel: { ...type.caption, color: colors.textFaint, marginTop: 8 },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 48,
    opacity: 0.01,
    color: 'transparent',
  },
  warning: { ...type.small, color: colors.danger, marginTop: 12 },
});
