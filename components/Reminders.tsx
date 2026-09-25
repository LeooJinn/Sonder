import { Pressable, StyleSheet, Text, View } from 'react-native';
import { reminderStatus, type Reminder, type ReminderState } from '../lib/reminders';
import { colors, fonts, radius, type } from '../lib/theme';
import { Button, SectionHeader, focusRing, type PressState } from './ui';

export const STATE_COLORS: Record<ReminderState, string> = {
  overdue: colors.danger,
  soon: colors.accent,
  ok: colors.textMuted,
  untracked: colors.textFaint,
};

/**
 * "Coming up" on a car's page: every reminder, most urgent first, with how
 * far off it is. Tapping anywhere opens the full list to change them.
 */
export function RemindersSummary({
  reminders,
  mileage,
  onManage,
}: {
  reminders: Reminder[];
  mileage?: number;
  onManage: () => void;
}) {
  if (reminders.length === 0) {
    return (
      <View style={styles.invite}>
        <Text style={styles.inviteTitle}>Know what&apos;s due before it&apos;s due</Text>
        <Text style={styles.inviteBody}>
          Oil changes, brake fluid, registration. Sonder works out when each is next due from your
          log&apos;s mileage and dates.
        </Text>
        <Button label="Set up reminders" variant="quiet" onPress={onManage} />
      </View>
    );
  }

  const rows = reminders
    .map((reminder) => ({ reminder, status: reminderStatus(reminder, mileage) }))
    .sort((a, b) => a.status.urgency - b.status.urgency);

  return (
    <View>
      <SectionHeader
        title="Coming up"
        action={<Button label="Manage" variant="quiet" onPress={onManage} />}
      />
      <Pressable
        onPress={onManage}
        accessibilityRole="button"
        accessibilityHint="Opens this car's reminders"
        style={(state) => [
          styles.list,
          (state as PressState).pressed && styles.pressed,
          (state as PressState).focused && focusRing,
        ]}
      >
        {rows.map(({ reminder, status }, i) => (
          <View key={reminder.id} style={[styles.row, i > 0 && styles.rowDivided]}>
            <View style={[styles.mark, { backgroundColor: STATE_COLORS[status.state] }]} />
            <Text style={styles.title} numberOfLines={1}>
              {reminder.title}
            </Text>
            <Text style={[styles.status, { color: STATE_COLORS[status.state] }]} numberOfLines={2}>
              {status.text}
            </Text>
          </View>
        ))}
      </Pressable>
      {mileage !== undefined ? (
        <Text style={styles.basis}>
          Based on {mileage.toLocaleString('en-US')} mi, the highest reading in your log.
        </Text>
      ) : null}
    </View>
  );
}


const styles = StyleSheet.create({
  invite: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.page,
    padding: 18,
    gap: 6,
  },
  inviteTitle: { ...type.bodyStrong, color: colors.text },
  inviteBody: { ...type.small, color: colors.textMuted, marginBottom: 6 },

  list: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.page,
    paddingHorizontal: 16,
  },
  pressed: { backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  rowDivided: { borderTopWidth: 1, borderTopColor: colors.border },
  mark: { width: 8, height: 8, borderRadius: 4 },
  title: { ...type.bodyStrong, color: colors.text, flex: 1 },
  status: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 18, textAlign: 'right', flexShrink: 1, maxWidth: '55%' },
  basis: { ...type.caption, color: colors.textFaint, marginTop: 8 },
});
