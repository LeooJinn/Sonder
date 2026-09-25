import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { groupedRegions, regionLabel } from '../lib/regions';
import { colors, fonts, radius, type } from '../lib/theme';
import { focusRing, type PressState } from './ui';

/**
 * A select, built from a Modal rather than a picker library.
 *
 * React Native has no cross-platform select: iOS and Android render the
 * native one completely differently, and neither exists on web. A modal list
 * looks and behaves the same everywhere, and costs no dependency.
 */
export function RegionPicker({
  value,
  onChange,
}: {
  value: string;
  /** Empty string means "not set" — distinct from "unchanged". */
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = regionLabel(value);

  function select(code: string) {
    onChange(code);
    setOpen(false);
  }

  return (
    <>
      <Pressable
        style={(state) => {
          const { pressed, focused } = state as PressState;
          return [styles.trigger, pressed && styles.triggerPressed, focused && focusRing];
        }}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Region: ${label ?? 'not set'}`}
      >
        <Text style={label ? styles.triggerValue : styles.triggerPlaceholder}>
          {label ?? 'Choose a region'}
        </Text>
        <Text style={styles.chevron}>Change</Text>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        {/* Tapping the dimmed area closes, which is what people expect. */}
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          {/* Stops a tap inside the sheet from reaching the backdrop above. */}
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Region</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Text style={styles.close}>Close</Text>
              </Pressable>
            </View>

            <ScrollView>
              <Pressable
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                onPress={() => select('')}
              >
                <Text style={[styles.optionText, !value && styles.optionTextActive]}>
                  Not set
                </Text>
                {!value && <Text style={styles.tick}>✓</Text>}
              </Pressable>

              {groupedRegions().map(({ group, regions }) => (
                <View key={group}>
                  <Text style={styles.groupLabel}>{group}</Text>
                  {regions.map((region) => {
                    const selected = region.code === value;
                    return (
                      <Pressable
                        key={region.code}
                        style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                        onPress={() => select(region.code)}
                      >
                        <Text style={[styles.optionText, selected && styles.optionTextActive]}>
                          {region.label}
                        </Text>
                        {selected && <Text style={styles.tick}>✓</Text>}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerPressed: { opacity: 0.8 },
  triggerValue: { ...type.body, color: colors.text },
  triggerPlaceholder: { ...type.body, color: colors.textFaint },
  chevron: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.accent },

  backdrop: { flex: 1, backgroundColor: '#0A1512B3', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.page,
    borderTopRightRadius: radius.page,
    maxHeight: '75%',
    paddingBottom: 24,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: { ...type.heading, color: colors.text },
  close: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.accent },

  groupLabel: {
    ...type.label,
    color: colors.textFaint,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 6,
  },
  option: {
    paddingHorizontal: 20,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionPressed: { backgroundColor: colors.surface },
  optionText: { ...type.body, color: colors.textMuted },
  optionTextActive: { fontFamily: fonts.bodySemi, color: colors.text },
  tick: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.accent },
});
