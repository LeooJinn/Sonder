import { StyleSheet, Text, View } from 'react-native';
import { calendarSheet, formatClock, formatMeetDay } from '../lib/dates';
import { regionLabel } from '../lib/regions';
import type { Meet } from '../lib/meets';
import { colors, fonts, radius, type } from '../lib/theme';
import { Guilloche } from './Guilloche';
import { LiftPressable } from './LiftPressable';
import { ownerName } from './Timeline';
import { focusRing, type PressState } from './ui';

/**
 * One meet as a ticket: its date on a stub at the left, because "when" is the
 * first thing anyone scans a list of meets for, torn off along a perforation
 * from what, where and who. Printed on engraved paper like every document.
 * The next meet is drawn large.
 */
export function MeetTicket({
  meet,
  showRegion,
  big = false,
  onPress,
}: {
  meet: Meet;
  showRegion: boolean;
  big?: boolean;
  onPress: () => void;
}) {
  const sheet = calendarSheet(meet.startsAt);
  const where = [meet.place, showRegion ? regionLabel(meet.region) : undefined].filter(Boolean).join(', ');
  const stub = big ? 132 : 84;

  return (
    <LiftPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${meet.title}, ${formatMeetDay(meet.startsAt)} at ${formatClock(meet.startsAt)}, ${where}`}
      style={(state) => [styles.press, (state as PressState).focused && focusRing]}
    >
      <View style={styles.ticket}>
        <Guilloche opacity={0.3} />
        <View style={[styles.stub, { width: stub }]}>
          <Text style={styles.stubWeekday}>{sheet.weekday}</Text>
          <Text style={[styles.stubDay, big && styles.stubDayBig]}>{sheet.day}</Text>
          <Text style={styles.stubMonth}>{sheet.month}</Text>
        </View>
        {/* the perforation, with the two bites the tear leaves at its ends */}
        <View style={[styles.perforation, { left: stub }]} pointerEvents="none" />
        <View style={[styles.notch, styles.notchTop, { left: stub - 9 }]} pointerEvents="none" />
        <View style={[styles.notch, styles.notchBottom, { left: stub - 9 }]} pointerEvents="none" />

        <View style={styles.body}>
          <Text style={[styles.rowTitle, big && styles.rowTitleBig]} numberOfLines={big ? 3 : 2}>
            {meet.title}
          </Text>
          <Text style={styles.rowWhen}>
            {formatMeetDay(meet.startsAt)}, {formatClock(meet.startsAt)}
          </Text>
          <Text style={styles.rowWhere} numberOfLines={2}>
            {where}
          </Text>
          {big && meet.details ? (
            <Text style={styles.rowDetails} numberOfLines={3}>
              {meet.details}
            </Text>
          ) : null}
          <View style={styles.rowFoot}>
            <Text style={styles.rowWho} numberOfLines={1}>
              {meet.isMine ? 'Your meet' : `Hosted by ${ownerName(meet.host, 'a member')}`}
            </Text>
            <View style={styles.going}>
              <Text style={styles.goingCount}>{meet.goingCount}</Text>
              <Text style={styles.goingLabel}>going</Text>
            </View>
          </View>
          {meet.hiddenAt ? <Text style={styles.rowHidden}>Hidden after reports. Only you can see it.</Text> : null}
        </View>
      </View>
    </LiftPressable>
  );
}

const styles = StyleSheet.create({
  press: { borderRadius: radius.page },
  ticket: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    borderRadius: radius.page,
    overflow: 'hidden',
    minHeight: 132,
  },
  stub: {
    backgroundColor: colors.paperShade,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  stubWeekday: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.inkMuted },
  stubDay: { fontFamily: fonts.displayBold, fontSize: 44, lineHeight: 46, color: colors.ink, fontVariant: ['tabular-nums'] },
  stubDayBig: { fontSize: 72, lineHeight: 72 },
  stubMonth: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.inkMuted },
  perforation: {
    position: 'absolute',
    top: 12,
    bottom: 12,
    width: 0,
    borderLeftWidth: 2,
    borderLeftColor: colors.paperLine,
    borderStyle: 'dashed',
  },
  notch: { position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: colors.background },
  notchTop: { top: -9 },
  notchBottom: { bottom: -9 },
  body: { flex: 1, paddingVertical: 16, paddingLeft: 22, paddingRight: 18 },
  rowTitle: { fontFamily: fonts.displayBold, fontSize: 26, lineHeight: 28, color: colors.ink },
  rowTitleBig: { fontSize: 44, lineHeight: 44, letterSpacing: -0.4 },
  rowWhen: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink, marginTop: 8 },
  rowWhere: { ...type.small, color: colors.inkMuted, marginTop: 2 },
  rowDetails: { ...type.compact, color: colors.inkMuted, marginTop: 12 },
  rowFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14 },
  rowWho: { ...type.small, flex: 1, color: colors.inkMuted },
  going: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  goingCount: { fontFamily: fonts.displayBold, fontSize: 24, color: colors.ink, fontVariant: ['tabular-nums'] },
  goingLabel: { ...type.small, color: colors.inkMuted },
  rowHidden: { ...type.small, color: colors.stampInk, marginTop: 6 },
});
