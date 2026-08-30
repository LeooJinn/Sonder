import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { groupedRegions, regionLabel } from '../lib/regions';
import { colors } from '../lib/theme';

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
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
        onPress={() => setOpen(true)}
      >
        <Text style={label ? styles.triggerValue : styles.triggerPlaceholder}>
          {label ?? 'Choose a region'}
        </Text>
        <Text style={styles.chevron}>▾</Text>
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
    borderRadius: 4,
    paddingHorizontal: 13,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerPressed: { opacity: 0.8 },
  triggerValue: { color: colors.text, fontSize: 16 },
  triggerPlaceholder: { color: colors.disabled, fontSize: 16 },
  chevron: { color: colors.textMuted, fontSize: 13 },

  backdrop: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: '75%',
    paddingBottom: 24,
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
  sheetTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  close: { color: colors.accent, fontSize: 14, fontWeight: '600' },

  groupLabel: {
    color: colors.textFaint,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingTop: 18,
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
  optionText: { color: colors.textMuted, fontSize: 16 },
  optionTextActive: { color: colors.text, fontWeight: '600' },
  tick: { color: colors.accent, fontSize: 15, fontWeight: '700' },
});
