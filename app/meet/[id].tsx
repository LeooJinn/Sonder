import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { cancelMeet, cancelRsvp, loadMeet, rsvp, type MeetDetail } from '../../lib/meets';
import { loadGarage, type SavedVehicle } from '../../lib/garage';
import { calendarSheet, formatClock, formatMeetDay } from '../../lib/dates';
import { regionLabel } from '../../lib/regions';
import { describeError } from '../../lib/errors';
import { ownerName } from '../../components/Timeline';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ReportSheet } from '../../components/ReportSheet';
import { blockMember, reportMeet } from '../../lib/moderation';
import { Button, ErrorState, Notice, SectionHeader, focusRing, type PressState } from '../../components/ui';
import { colors, column, fonts, radius, type } from '../../lib/theme';

/** "no car" is a real answer: plenty of people turn up in a daily driver. */
const NO_CAR = '';

export default function MeetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [meet, setMeet] = useState<MeetDetail | null | undefined>(undefined);
  const [garage, setGarage] = useState<SavedVehicle[]>([]);
  const [choice, setChoice] = useState(NO_CAR);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [askingCancel, setAskingCancel] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [askingBlock, setAskingBlock] = useState(false);

  const load = useCallback(() => {
    setError(null);
    Promise.all([loadMeet(id), loadGarage()])
      .then(([found, cars]) => {
        setMeet(found);
        setGarage(cars);
        // Default to the car they already said, else their only car.
        setChoice(found?.myRsvp ? found.myRsvp.vin ?? NO_CAR : cars.length === 1 ? cars[0].vin : NO_CAR);
      })
      .catch((e) => setError(describeError(e)));
  }, [id]);

  useFocusEffect(load);

  async function act(action: () => Promise<void>) {
    setWorking(true);
    setActionError(null);
    try {
      await action();
      setMeet(await loadMeet(id));
    } catch (e) {
      setActionError(describeError(e));
    } finally {
      setWorking(false);
    }
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Meet' }} />
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  if (meet === undefined) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Stack.Screen options={{ title: 'Meet' }} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (meet === null) {
    return (
      <View style={[styles.screen, styles.missing]}>
        <Stack.Screen options={{ title: 'Meet' }} />
        <Text style={styles.missingTitle}>This meet was cancelled</Text>
        <Text style={styles.missingBody}>Its host took it down. Other meets are under Meets.</Text>
        <Button label="See meets" onPress={() => router.replace('/meets')} />
      </View>
    );
  }

  const sheet = calendarSheet(meet.startsAt);
  const going = meet.myRsvp !== undefined;
  const bringing = garage.find((car) => car.vin === meet.myRsvp?.vin);
  const cars = meet.attendees.filter((a) => a.car);
  const changedCar = going && choice !== (meet.myRsvp?.vin ?? NO_CAR);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Meet' }} />

      <View style={styles.hero}>
        <View style={styles.sheet}>
          <Text style={styles.sheetWeekday}>{sheet.weekday}</Text>
          <Text style={styles.sheetDay}>{sheet.day}</Text>
          <Text style={styles.sheetMonth}>{sheet.month}</Text>
        </View>
        <View style={styles.heroText}>
          <Text style={styles.title} accessibilityRole="header">
            {meet.title}
          </Text>
          <Text style={styles.when}>
            {formatMeetDay(meet.startsAt)} at {formatClock(meet.startsAt)}
          </Text>
        </View>
      </View>

      <View style={styles.facts}>
        <Fact label="Where" value={`${meet.place}, ${regionLabel(meet.region) ?? meet.region}`} />
        <Fact
          label="Hosted by"
          value={meet.isMine ? 'You' : ownerName(meet.host, 'A member')}
        />
      </View>

      {meet.details ? <Text style={styles.details}>{meet.details}</Text> : null}

      {meet.isMine && meet.hiddenAt ? (
        <View style={styles.hiddenNotice}>
          <Notice tone="error">
            Members reported this meet, so it&apos;s hidden from everyone but you until it&apos;s
            been reviewed.
          </Notice>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title={going ? "You're going" : 'Going?'} />

        {garage.length > 0 && (
          <>
            <Text style={styles.label}>
              {going ? 'Bringing' : 'Which car are you bringing?'}
            </Text>
            <View style={styles.choices} accessibilityRole="radiogroup">
              {[...garage.map((car) => ({ vin: car.vin, label: `${car.year} ${car.make} ${car.model}` })),
                { vin: NO_CAR, label: 'Not bringing a car' }].map((option) => {
                const selected = choice === option.vin;
                return (
                  <Pressable
                    key={option.vin || 'none'}
                    onPress={() => setChoice(option.vin)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={(state) => [
                      styles.choice,
                      selected && styles.choiceSelected,
                      (state as PressState).focused && focusRing,
                    ]}
                  >
                    <View style={[styles.radio, selected && styles.radioSelected]} />
                    <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {actionError && <Notice tone="error">{actionError}</Notice>}

        {!going ? (
          <Button
            label="I'm going"
            busy={working}
            onPress={() => act(() => rsvp(meet.id, choice || undefined))}
          />
        ) : (
          <View style={styles.goingActions}>
            {changedCar ? (
              <Button
                label="Save change"
                busy={working}
                onPress={() => act(() => rsvp(meet.id, choice || undefined))}
              />
            ) : (
              <Text style={styles.goingNote}>
                {bringing
                  ? `You're bringing the ${bringing.model}.`
                  : "You're going without a car."}
              </Text>
            )}
            {!meet.isMine && (
              <Button
                label="I can't make it"
                variant="quiet"
                onPress={() => act(() => cancelRsvp(meet.id))}
              />
            )}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title={`${meet.attendees.length} going`} />
        {cars.length > 0 && (
          <Text style={styles.carCount}>
            {cars.length} {cars.length === 1 ? 'car' : 'cars'} so far.
          </Text>
        )}
        {meet.attendees.map((person) => (
          <View key={person.id} style={styles.attendee}>
            <Text style={styles.attendeeName}>
              {ownerName(person, 'A member')}
              {person.id === meet.host.id ? <Text style={styles.hostTag}>  host</Text> : null}
            </Text>
            <Text style={styles.attendeeCar}>
              {person.car
                ? [person.car.year, person.car.make, person.car.model].filter(Boolean).join(' ')
                : 'No car'}
            </Text>
          </View>
        ))}
      </View>

      {meet.isMine ? (
        <View style={styles.section}>
          <Button label="Cancel this meet" variant="danger" onPress={() => setAskingCancel(true)} />
        </View>
      ) : (
        <View style={styles.moderation}>
          <Button label="Report this meet" variant="quiet" onPress={() => setReporting(true)} />
          <Button
            label={`Block ${ownerName(meet.host, 'the host')}`}
            variant="quiet"
            onPress={() => setAskingBlock(true)}
          />
        </View>
      )}

      <ReportSheet
        visible={reporting}
        what="meet"
        onSubmit={(reason, note) => reportMeet(meet.id, reason, note)}
        onClose={() => setReporting(false)}
      />

      <ConfirmDialog
        visible={askingBlock}
        title={`Block ${ownerName(meet.host, 'this member')}?`}
        body="You won't see their meets or the cars they sell. They aren't told. You can unblock them from your profile."
        confirmLabel="Block"
        onConfirm={async () => {
          await blockMember(meet.host.id);
          router.replace('/meets');
        }}
        onCancel={() => setAskingBlock(false)}
      />

      <ConfirmDialog
        visible={askingCancel}
        title="Cancel this meet?"
        body="It disappears from Meets for everyone, including the people who said they're going. This can't be undone."
        consequences={[
          `${meet.attendees.length} ${meet.attendees.length === 1 ? 'person' : 'people'} going`,
        ]}
        confirmLabel="Cancel meet"
        onConfirm={async () => {
          await cancelMeet(meet.id);
          router.replace('/meets');
        }}
        onCancel={() => setAskingCancel(false)}
      />
    </ScrollView>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 56, ...column },

  hero: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  sheet: {
    width: 76,
    backgroundColor: colors.paper,
    borderRadius: radius.control,
    alignItems: 'center',
    paddingVertical: 10,
  },
  sheetWeekday: { ...type.caption, color: colors.inkMuted },
  sheetDay: { fontFamily: fonts.displayBold, fontSize: 38, lineHeight: 40, color: colors.ink },
  sheetMonth: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.inkMuted },
  heroText: { flex: 1 },
  title: { ...type.display, color: colors.text },
  when: { ...type.body, color: colors.textMuted, marginTop: 6 },

  facts: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 14,
  },
  fact: { gap: 2 },
  factLabel: { ...type.caption, color: colors.textFaint },
  factValue: { ...type.bodyStrong, color: colors.text },

  details: { ...type.body, color: colors.textMuted, marginTop: 20 },

  section: { marginTop: 40 },
  label: { ...type.label, color: colors.textMuted, marginBottom: 8 },

  choices: { gap: 8, marginBottom: 20 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
  },
  choiceSelected: { borderColor: colors.accent, backgroundColor: colors.surface },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.textFaint },
  radioSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  choiceText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.textMuted },
  choiceTextSelected: { color: colors.text },

  goingActions: { gap: 16 },
  goingNote: { ...type.body, color: colors.text },

  carCount: { ...type.small, color: colors.textMuted, marginTop: -6, marginBottom: 8 },
  attendee: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  attendeeName: { ...type.bodyStrong, color: colors.text, flexShrink: 1 },
  hostTag: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.accent },
  attendeeCar: { ...type.small, color: colors.textMuted, textAlign: 'right', flexShrink: 1 },

  hiddenNotice: { marginTop: 20 },
  moderation: {
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
  },

  missing: { padding: 24, justifyContent: 'center', gap: 12 },
  missingTitle: { ...type.title, color: colors.text },
  missingBody: { ...type.body, color: colors.textMuted, marginBottom: 12 },
});
