import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { loadMyProfile, updateMyProfile } from '../lib/profile';
import { signOut } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { RegionPicker } from '../components/RegionPicker';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AccountSecurity } from '../components/AccountSecurity';
import { LegalLinks } from '../components/LegalLinks';
import { deleteAccount } from '../lib/account';
import { loadPastVehicles, requestTransferCode, type SavedVehicle } from '../lib/garage';
import { TransferCodeDialog } from '../components/TransferCodeDialog';
import { loadBlocked, unblockMember, type BlockedMember } from '../lib/moderation';
import { loadMyFollowers, type Follower } from '../lib/follows';
import { loadMessageEmails, setMessageEmails } from '../lib/messages';
import { loadReminderEmails, setReminderEmails } from '../lib/reminders';
import { ownerName } from '../components/Timeline';
import { regionLabel } from '../lib/regions';
import { Guilloche } from '../components/Guilloche';
import { Monogram } from '../components/Monogram';
import { Button, Field, Notice, focusRing, type PressState } from '../components/ui';
import { colors, column, fonts, radius, type } from '../lib/theme';
import { WIDE_BREAKPOINT } from '../components/useWide';

function EmailSwitchRow({
  title,
  hint,
  value,
  onValueChange,
}: {
  title: string;
  hint: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchText}>
        <Text style={styles.emailsTitle}>{title}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={title}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={colors.paper}
        {...(Platform.OS === 'web' ? { activeThumbColor: colors.paper } : {})}
      />
    </View>
  );
}

export default function ProfileScreen() {
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [region, setRegion] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [askingDelete, setAskingDelete] = useState(false);
  const [blocked, setBlocked] = useState<BlockedMember[]>([]);
  const [followers, setFollowers] = useState<Follower[]>([]);
  // Null until known, so the switch doesn't flash the wrong way.
  const [messageEmails, setMessageEmailsOn] = useState<boolean | null>(null);
  const [reminderEmails, setReminderEmailsOn] = useState<boolean | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  // Cars this member sold, so a lost transfer code can be replaced.
  const [soldCars, setSoldCars] = useState<SavedVehicle[]>([]);
  const [newCode, setNewCode] = useState<{ code: string; car: string } | null>(null);
  const [soldError, setSoldError] = useState<string | null>(null);
  // The handle as stored, not as typed: the page link must point somewhere real.
  const [savedHandle, setSavedHandle] = useState('');
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;

  useEffect(() => {
    loadBlocked().then(setBlocked).catch(() => {});
    loadMyFollowers().then(setFollowers).catch(() => {});
    loadMessageEmails().then(setMessageEmailsOn).catch(() => {});
    loadReminderEmails().then(setReminderEmailsOn).catch(() => {});
    loadPastVehicles()
      .then((cars) => setSoldCars([...new Map(cars.map((car) => [car.vin, car])).values()]))
      .catch(() => {});
  }, []);

  async function getNewCode(car: SavedVehicle) {
    setSoldError(null);
    try {
      const code = await requestTransferCode(car.vin);
      setNewCode({ code, car: [car.year, car.make, car.model].filter(Boolean).join(' ') || 'car' });
    } catch (e) {
      setSoldError(
        /no sale/i.test(e instanceof Error ? e.message : '')
          ? 'That car has a new owner already, so there is nothing left to hand over.'
          : e instanceof Error
            ? e.message
            : 'That did not work. Try again.'
      );
    }
  }

  async function toggleEmails(
    next: boolean,
    setShown: (on: boolean) => void,
    save: (on: boolean) => Promise<void>
  ) {
    // Flips at once and goes back if it didn't save, like the public-link switch.
    setShown(next);
    setEmailError(null);
    try {
      await save(next);
    } catch (e) {
      setShown(!next);
      setEmailError(e instanceof Error ? e.message : 'That did not save. Try again.');
    }
  }

  useEffect(() => {
    Promise.all([loadMyProfile(), supabase.auth.getUser()])
      .then(([profile, auth]) => {
        setHandle(profile.handle ?? '');
        setSavedHandle(profile.handle ?? '');
        setDisplayName(profile.displayName ?? '');
        setRegion(profile.region ?? '');
        setEmail(auth.data.user?.email ?? '');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your profile.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setError(null);
    setSaved(false);
    setSaving(true);

    try {
      await updateMyProfile({ handle, displayName, region });
      setSavedHandle(handle.trim().toLowerCase());
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Stack.Screen options={{ title: 'Profile' }} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const shownAs = displayName.trim() || (handle ? `@${handle}` : 'A Sonder owner');
  const regionName = regionLabel(region);

  // Each group of settings is a divided section on a phone and a panel on a
  // wide screen, where they sit side by side.
  const group = wide ? styles.panel : styles.divided;

  const hero = (
    <View style={[styles.hero, wide && styles.heroWide]}>
      <Guilloche opacity={0.3} />
      <Monogram name={shownAs} size={wide ? 84 : 64} />
      <View style={styles.heroText}>
        {/* What strangers see on a shared passport, updated as you type. */}
        <Text style={styles.previewLabel}>On your passports</Text>
        <Text style={[styles.heroName, wide && styles.heroNameWide]} numberOfLines={1}>
          {shownAs}
        </Text>
        <Text style={styles.heroMeta}>
          {handle ? `@${handle}` : 'No handle yet'}
          {regionName ? `  ·  ${regionName}` : ''}
        </Text>
        <Text style={styles.previewLine}>
          Kept by {shownAs}
          {regionName ? ` in ${regionName}` : ''}
        </Text>
      </View>
      {savedHandle ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push(`/u/${savedHandle}`)}
          style={(state) => [styles.heroLink, (state as PressState).focused && focusRing]}
        >
          <Text style={styles.heroLinkText}>See your page</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const form = (
    <View>
      <Field
        label="Display name"
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Leo"
        hint="Shown against the work you log."
        autoComplete="name"
      />

      <Field
        label="Handle"
        value={handle}
        onChangeText={(text) => setHandle(text.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
        placeholder="leo"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={20}
        isMono
        hint={
          handle
            ? `Your page is imsonder.com/u/${handle}. People follow you there.`
            : 'Lowercase letters, numbers and underscores. Without one, people can follow your cars but not you.'
        }
      />

      <View style={styles.field}>
        <Text style={styles.label}>Region</Text>
        <RegionPicker value={region} onChange={setRegion} />
        <Text style={styles.hint}>Region only, never an address. Cars get stolen.</Text>
      </View>

      {error && <Notice tone="error">{error}</Notice>}
      {saved && <Notice tone="success">Profile saved.</Notice>}

      <Button label="Save profile" onPress={handleSave} busy={saving} />
    </View>
  );

  const emails =
    messageEmails !== null || reminderEmails !== null ? (
      <View style={[group, styles.emails]}>
        <Text style={styles.groupTitle}>Email</Text>
        {messageEmails !== null && (
          <EmailSwitchRow
            title="Email me about unread messages"
            hint="At most one email per conversation every few hours, and only if you haven't read the messages in Sonder. It says who wrote, never what they said."
            value={messageEmails}
            onValueChange={(next) => toggleEmails(next, setMessageEmailsOn, setMessageEmails)}
          />
        )}
        {reminderEmails !== null && (
          <EmailSwitchRow
            title="Email me when a reminder is due"
            hint="At most one email a week, listing what has come due on your cars. It names the car and the reminder, never a date or a mileage."
            value={reminderEmails}
            onValueChange={(next) => toggleEmails(next, setReminderEmailsOn, setReminderEmails)}
          />
        )}
        {emailError ? <Text style={styles.emailError}>{emailError}</Text> : null}
      </View>
    ) : null;

  const sold =
    soldCars.length > 0 ? (
      <View style={[group, styles.sold]}>
        <Text style={styles.groupTitle}>Sold cars</Text>
        <Text style={styles.hint}>
          Lost the code you gave a buyer, or never gave it? Get a new one while nobody has added the car yet.
        </Text>
        {soldCars.map((car) => (
          <View key={car.vin} style={styles.soldRow}>
            <Text style={styles.soldName}>
              {[car.year, car.make, car.model].filter(Boolean).join(' ') || car.vin}
            </Text>
            <Button label="Get a new transfer code" variant="quiet" onPress={() => getNewCode(car)} />
          </View>
        ))}
        {soldError ? <Text style={styles.emailError}>{soldError}</Text> : null}
      </View>
    ) : null;

  const account = (
    <View style={[group, styles.account]}>
      <Text style={styles.groupTitle}>Account</Text>
      <Text style={styles.accountLabel}>Signed in as</Text>
      <Text style={styles.email}>{email}</Text>
      <AccountSecurity email={email} />
      <Button
        label="Sign out"
        variant="secondary"
        onPress={async () => {
          await signOut();
          router.replace('/sign-in');
        }}
      />
    </View>
  );

  const followersBlock =
    followers.length > 0 ? (
      <View style={[group, styles.blocked]}>
        <Text style={styles.dangerTitle}>
          {followers.length} {followers.length === 1 ? 'person follows' : 'people follow'} you
        </Text>
        <Text style={styles.dangerBody}>Only you can see who they are.</Text>
        {followers.map((person) => (
          <View key={person.id} style={styles.blockedRow}>
            <View style={styles.personRow}>
              <Monogram name={ownerName(person, 'A member')} size={34} />
              <Text style={styles.blockedName}>{ownerName(person, 'A member')}</Text>
            </View>
            {person.handle ? (
              <Button label="Their page" variant="subtle" onPress={() => router.push(`/u/${person.handle}`)} />
            ) : null}
          </View>
        ))}
      </View>
    ) : null;

  const blockedBlock =
    blocked.length > 0 ? (
      <View style={[group, styles.blocked]}>
        <Text style={styles.dangerTitle}>Blocked members</Text>
        <Text style={styles.dangerBody}>
          You don&apos;t see their meets or the cars they sell. They haven&apos;t been told.
        </Text>
        {blocked.map((member) => (
          <View key={member.id} style={styles.blockedRow}>
            <Text style={styles.blockedName}>{ownerName(member, 'A member')}</Text>
            <Button
              label="Unblock"
              variant="subtle"
              onPress={async () => {
                await unblockMember(member.id);
                setBlocked((current) => current.filter((m) => m.id !== member.id));
              }}
            />
          </View>
        ))}
      </View>
    ) : null;

  const danger = (
    <View style={[group, styles.danger]}>
      <Text style={styles.dangerTitle}>Delete account</Text>
      <Text style={styles.dangerBody}>
        Your account, profile and any cars still in your garage are deleted permanently.
        Cars you sold keep their history for their current owner, with your name removed.
      </Text>
      <Button label="Delete my account" variant="danger" onPress={() => setAskingDelete(true)} />
    </View>
  );

  const legal = (
    <View style={styles.legalBlock}>
      <LegalLinks align="left" />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Profile' }} />

      <ScrollView contentContainerStyle={[styles.content, wide && styles.contentWide]} keyboardShouldPersistTaps="handled">
        {hero}

        {wide ? (
          <View style={styles.split}>
            <View style={styles.splitLeft}>
              <Text style={styles.groupTitle}>Your profile</Text>
              {form}
              {legal}
            </View>
            <View style={styles.splitRight}>
              {emails}
              {account}
              {sold}
              {followersBlock}
              {blockedBlock}
              {danger}
            </View>
          </View>
        ) : (
          <>
            {form}
            {emails}
            {sold}
            {legal}
            {account}
            {followersBlock}
            {blockedBlock}
            {danger}
          </>
        )}

        <TransferCodeDialog
          visible={newCode !== null}
          code={newCode?.code ?? ''}
          title="Your new transfer code"
          car={newCode?.car ?? 'car'}
          onClose={() => setNewCode(null)}
        />
      </ScrollView>

      <ConfirmDialog
        visible={askingDelete}
        title="Delete your account?"
        body="This cannot be undone. You will be signed out immediately and will not be able to sign back in with this email."
        consequences={[
          'Your profile and handle are released',
          'Cars still in your garage are deleted, with their logs and photos',
          'Cars you sold keep their history, with your name removed',
        ]}
        confirmLabel="Delete account"
        confirmPhrase="DELETE MY ACCOUNT"
        onConfirm={async () => {
          await deleteAccount();
          router.replace('/sign-in');
        }}
        onCancel={() => setAskingDelete(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 56, ...column },
  contentWide: { maxWidth: 1120, paddingHorizontal: 40, paddingTop: 36 },

  hero: {
    backgroundColor: colors.paper,
    borderRadius: radius.page,
    padding: 18,
    marginBottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    overflow: 'hidden',
  },
  heroWide: { padding: 28, gap: 24, marginBottom: 40 },
  heroLink: { minHeight: 44, justifyContent: 'center' },
  heroLinkText: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.ink, textDecorationLine: 'underline' },
  heroText: { flex: 1, minWidth: 180 },
  heroName: { ...type.display, fontSize: 30, lineHeight: 32, color: colors.ink, marginTop: 2 },
  heroNameWide: { fontSize: 52, lineHeight: 50 },
  heroMeta: { fontFamily: fonts.mono, fontSize: 13, color: colors.inkMuted, marginTop: 6 },
  previewLabel: { ...type.caption, color: colors.inkMuted },
  previewLine: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 22, color: colors.inkMuted, marginTop: 8 },

  split: { flexDirection: 'row', gap: 56, alignItems: 'flex-start' },
  splitLeft: { width: 440 },
  splitRight: { flex: 1, minWidth: 0, gap: 20 },

  field: { marginBottom: 24 },
  label: { ...type.label, color: colors.textMuted, marginBottom: 8 },
  hint: { ...type.caption, color: colors.textFaint, marginTop: 8 },

  // A divided section on a phone; a panel beside others on a wide screen.
  divided: { marginTop: 40, paddingTop: 24, borderTopWidth: 1, borderTopColor: colors.border },
  panel: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.page, padding: 22 },
  groupTitle: { ...type.title, color: colors.text, marginBottom: 14 },

  emails: { gap: 24 },
  switchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  switchText: { flex: 1, gap: 4 },
  emailsTitle: { ...type.bodyStrong, color: colors.text },
  legalBlock: { marginTop: 32 },
  sold: { gap: 8 },
  soldRow: { gap: 4, marginTop: 8 },
  soldName: { ...type.body, color: colors.text },
  emailError: { ...type.caption, color: colors.danger, marginTop: 8 },

  account: {},
  accountLabel: { ...type.caption, color: colors.textFaint },
  email: { ...type.body, color: colors.text, marginTop: 2, marginBottom: 16 },

  blocked: { gap: 8 },
  blockedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  blockedName: { ...type.bodyStrong, color: colors.text },

  danger: { gap: 8 },
  dangerTitle: { ...type.heading, color: colors.text },
  dangerBody: { ...type.small, color: colors.textMuted, marginBottom: 8 },
});
