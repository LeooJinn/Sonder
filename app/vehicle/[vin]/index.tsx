import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  findOwnershipId,
  findVehicle,
  markSold,
  removeVehicle,
  type SavedVehicle,
} from '../../../lib/garage';
import {
  addGalleryPhoto,
  loadGallery,
  pickImages,
  removePhoto,
  setPhotoCaption,
  type Photo,
} from '../../../lib/photos';
import { Gallery } from '../../../components/Gallery';
import { loadPriorHistory, type PriorPeriod } from '../../../lib/history';
import {
  formatCents,
  loadEntries,
  removeEntriesForVehicle,
  type LogEntry,
} from '../../../lib/log';
import { isPassportPublic, setPassportPublic } from '../../../lib/passport';
import { formatMonthYear } from '../../../lib/dates';
import { DataPage } from '../../../components/DataPage';
import { Timeline, type Chapter } from '../../../components/Timeline';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Button, SectionHeader } from '../../../components/ui';
import { colors, column, fonts, radius, type } from '../../../lib/theme';

/** Where a published passport lives. Local web builds link to themselves. */
function passportUrl(vin: string): string {
  const origin =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.origin
      : 'https://www.imsonder.com';
  return `${origin}/p/${vin}`;
}

/** "4 entries, $3,149 logged." — the sums a buyer actually asks about. */
function chapterSummary(entries: LogEntry[]): string {
  if (entries.length === 0) return '';
  const spent = entries.reduce((total, e) => total + (e.costCents ?? 0), 0);
  const count = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;
  return spent > 0 ? `${count}, ${formatCents(spent)} logged.` : `${count}.`;
}

function ownerName(owner: PriorPeriod['owner']): string {
  if (owner.displayName) return owner.displayName;
  if (owner.handle) return `@${owner.handle}`;
  return 'A previous owner';
}

/**
 * The square brackets in the folder name make this a dynamic route:
 * /vehicle/1FMCU0G65LUA35573 lands here with vin set to that string.
 */
export default function VehicleScreen() {
  const { vin } = useLocalSearchParams<{ vin: string }>();
  const [vehicle, setVehicle] = useState<SavedVehicle | null>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [prior, setPrior] = useState<PriorPeriod[]>([]);
  const [askingSold, setAskingSold] = useState(false);
  const [askingRemove, setAskingRemove] = useState(false);
  const [ownershipId, setOwnershipId] = useState<string | null>(null);
  const [gallery, setGallery] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  const photoCount =
    entries.reduce((total, entry) => total + entry.photos.length, 0) + gallery.length;

  // "Copied" is confirmation, not state: it goes back after a moment.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function handleAddGalleryPhotos() {
    if (!ownershipId) return;

    setUploading(true);
    try {
      const uris = await pickImages();
      // position counts down from the current top so newest sorts first.
      let position = gallery.length;
      for (const uri of uris) {
        const photo = await addGalleryPhoto(ownershipId, uri, undefined, position++);
        setGallery((current) => [photo, ...current]);
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleSold() {
    await markSold(vin);
    router.replace('/');
  }

  async function togglePublic(next: boolean) {
    // Optimistic: flip immediately so the switch feels instant, and put it
    // back if the write fails.
    setIsPublic(next);
    setPublishError(null);

    try {
      await setPassportPublic(vin, next);
    } catch (e) {
      setIsPublic(!next);
      setPublishError(e instanceof Error ? e.message : 'Sharing could not be changed. Try again.');
    }
  }

  async function shareLink() {
    const url = passportUrl(vin);
    // The web has a clipboard but a patchy share sheet; phones are the
    // other way round.
    if (Platform.OS === 'web' && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } else {
      await Share.share({ message: url, url });
    }
  }

  // Reloads on every focus so an entry added on the next screen shows up
  // when you come back — same reason the garage list uses this.
  useFocusEffect(
    useCallback(() => {
      Promise.all([
        findVehicle(vin),
        loadEntries(vin),
        isPassportPublic(vin),
        loadPriorHistory(vin),
        findOwnershipId(vin),
      ]).then(async ([found, log, published, history, ownership]) => {
        setVehicle(found);
        setEntries(log);
        setIsPublic(published);
        setPrior(history);
        setOwnershipId(ownership);
        setGallery(ownership ? await loadGallery(ownership) : []);
        setLoaded(true);
      });
    }, [vin])
  );

  async function handleRemove() {
    // Delete the log too. Otherwise removing a car leaves its history
    // orphaned in storage with nothing pointing at it.
    await removeEntriesForVehicle(vin);
    await removeVehicle(vin);
    router.replace('/');
  }

  if (!loaded) return <View style={styles.screen} />;

  if (!vehicle) {
    return (
      <View style={[styles.screen, styles.missing]}>
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text style={styles.missingTitle}>This car isn&apos;t in your garage</Text>
        <Text style={styles.missingBody}>
          It may have been removed or marked as sold. Your garage has everything you still own.
        </Text>
        <Button label="Go to your garage" onPress={() => router.replace('/')} />
      </View>
    );
  }

  const chapters: Chapter[] = [
    {
      key: 'mine',
      title: 'Your time with it',
      subtitle: [`Since ${formatMonthYear(vehicle.addedAt)}.`, chapterSummary(entries)]
        .filter(Boolean)
        .join(' '),
      entries,
      empty: 'Nothing logged yet. Mods, service, repairs and milestones all go here.',
      onPressEntry: (entry) => router.push(`/vehicle/${vin}/entry/${entry.id}`),
    },
    ...prior.map((period) => ({
      key: period.ownershipId,
      title: `${ownerName(period.owner)}'s time with it`,
      subtitle: `${formatMonthYear(period.startedOn)} to ${formatMonthYear(period.endedOn)}. ${chapterSummary(period.entries)}`.trim(),
      note: 'Logged by a previous owner, so it can be read but not changed.',
      entries: period.entries,
      empty: 'Nothing was logged in this time.',
    })),
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: `${vehicle.year} ${vehicle.make}` }} />

      <DataPage
        vehicle={vehicle}
        photoUrl={gallery[0]?.url ?? vehicle.cover?.url}
        holder={`Kept by you since ${formatMonthYear(vehicle.addedAt)}`}
      />

      <Button
        label="Add to log"
        onPress={() => router.push(`/vehicle/${vin}/add`)}
        style={styles.addButton}
      />

      <View style={styles.section}>
        <Timeline chapters={chapters} />
      </View>

      <View style={styles.section}>
        <Gallery
          photos={gallery}
          busy={uploading}
          onAdd={handleAddGalleryPhotos}
          onRemove={async (photo) => {
            await removePhoto(photo);
            setGallery((current) => current.filter((p) => p.id !== photo.id));
          }}
          onCaption={async (photo, caption) => {
            await setPhotoCaption(photo.id, caption);
            setGallery((current) =>
              current.map((p) => (p.id === photo.id ? { ...p, caption } : p))
            );
          }}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Passport" />
        <View style={styles.panel}>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.panelTitle}>Public link</Text>
              <Text style={styles.panelBody}>
                {isPublic
                  ? 'Anyone with the link can read this log and see its photos. Your name and region are shown, never your email.'
                  : 'Only you can see this log. Turn this on for a link to send a buyer, a shop or the next owner.'}
              </Text>
            </View>
            <Switch
              value={isPublic}
              onValueChange={togglePublic}
              accessibilityLabel="Public link"
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.paper}
              {...(Platform.OS === 'web' ? { activeThumbColor: colors.paper } : {})}
            />
          </View>

          {isPublic && (
            <View style={styles.linkRow}>
              <Text style={styles.link} numberOfLines={1} selectable>
                {passportUrl(vin).replace(/^https?:\/\/(www\.)?/, '')}
              </Text>
              <View style={styles.linkActions}>
                <Button
                  label={Platform.OS === 'web' ? (copied ? 'Copied' : 'Copy link') : 'Share link'}
                  variant="secondary"
                  onPress={shareLink}
                  style={styles.linkButton}
                />
                <Button
                  label="View as visitor"
                  variant="quiet"
                  onPress={() => router.push(`/p/${vin}`)}
                />
              </View>
            </View>
          )}

          {publishError && <Text style={styles.error}>{publishError}</Text>}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Ownership" />
        <Text style={styles.ownershipBody}>
          Selling it? Mark it as sold and the log goes with the car. The next owner reads your
          time with it, and it stays credited to you.
        </Text>
        <Button label="I sold this car" variant="secondary" onPress={() => setAskingSold(true)} />

        <Button
          label="Remove from garage"
          variant="danger"
          onPress={() => setAskingRemove(true)}
          style={styles.removeButton}
        />
        <Text style={styles.removeHint}>
          Removing deletes the log and photos for good. Only use it for a car added by mistake.
        </Text>
      </View>

      <ConfirmDialog
        visible={askingSold}
        title="Mark this car as sold?"
        body={`It leaves your garage, but nothing is deleted. Your ${entries.length} ${
          entries.length === 1 ? 'entry stays' : 'entries stay'
        } with the car, credited to you, and the next owner can read them.`}
        confirmLabel="Mark as sold"
        onConfirm={handleSold}
        onCancel={() => setAskingSold(false)}
      />

      <ConfirmDialog
        visible={askingRemove}
        title="Delete this car and its log?"
        body="This is permanent. If you sold the car, cancel and use 'I sold this car' instead so its history survives for the next owner."
        consequences={[
          `${entries.length} log ${entries.length === 1 ? 'entry' : 'entries'} deleted`,
          `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'} deleted`,
          isPublic ? 'The public passport link stops working' : 'Your ownership record is erased',
        ]}
        confirmLabel="Delete forever"
        confirmPhrase="DELETE"
        onConfirm={handleRemove}
        onCancel={() => setAskingRemove(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 56, ...column },

  addButton: { marginTop: 16 },
  section: { marginTop: 40 },

  panel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.page,
    padding: 18,
  },
  switchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  switchText: { flex: 1, gap: 4 },
  panelTitle: { ...type.bodyStrong, color: colors.text },
  panelBody: { ...type.small, color: colors.textMuted },
  linkRow: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  link: { fontFamily: fonts.mono, fontSize: 13, color: colors.text },
  linkActions: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  linkButton: { minHeight: 44, paddingHorizontal: 16 },
  error: { ...type.small, color: colors.danger, marginTop: 12 },

  ownershipBody: { ...type.small, color: colors.textMuted, marginBottom: 14 },
  removeButton: { marginTop: 12 },
  removeHint: { ...type.caption, color: colors.textFaint, marginTop: 8 },

  missing: { padding: 24, justifyContent: 'center', gap: 12 },
  missingTitle: { ...type.title, color: colors.text },
  missingBody: { ...type.body, color: colors.textMuted, marginBottom: 12 },
});
