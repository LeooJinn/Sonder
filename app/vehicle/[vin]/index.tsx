import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { loadEntries, removeEntriesForVehicle, type LogEntry } from '../../../lib/log';
import { isPassportPublic, setPassportPublic } from '../../../lib/passport';
import { SpecList } from '../../../components/SpecList';
import { EntryCard } from '../../../components/EntryCard';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { colors, column, mono } from '../../../lib/theme';

/**
 * The square brackets in the folder name make this a dynamic route:
 * /vehicle/1FMCU0G65LUA35573 lands here with vin set to that string.
 */
export default function VehicleScreen() {
  const { vin } = useLocalSearchParams<{ vin: string }>();
  const [vehicle, setVehicle] = useState<SavedVehicle | null>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [prior, setPrior] = useState<PriorPeriod[]>([]);
  const [askingSold, setAskingSold] = useState(false);
  const [askingRemove, setAskingRemove] = useState(false);
  const [ownershipId, setOwnershipId] = useState<string | null>(null);
  const [gallery, setGallery] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  const photoCount =
    entries.reduce((total, entry) => total + entry.photos.length, 0) + gallery.length;

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

  async function togglePublic() {
    const next = !isPublic;
    // Optimistic: flip immediately so the toggle feels instant, and put it
    // back if the write fails.
    setIsPublic(next);
    setPublishError(null);

    try {
      await setPassportPublic(vin, next);
    } catch (e) {
      setIsPublic(!next);
      setPublishError(e instanceof Error ? e.message : 'Could not change sharing.');
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
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text style={styles.missing}>That vehicle isn&apos;t in your garage.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: `${vehicle.year} ${vehicle.make}` }} />

      <Text style={styles.title}>
        {vehicle.year} {vehicle.make} {vehicle.model}
      </Text>
      {vehicle.trim ? <Text style={styles.trim}>{vehicle.trim}</Text> : null}

      <View style={styles.plate}>
        <SpecList vehicle={vehicle} />
      </View>

      <View style={styles.gallerySection}>
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

      <View style={styles.logHeader}>
        <Text style={styles.logTitle}>Build log</Text>
        <Text style={styles.logCount}>
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </Text>
      </View>

      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Nothing logged yet. Mods, service, repairs and milestones go here.
          </Text>
        </View>
      ) : (
        <View style={styles.entries}>
          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onPress={() => router.push(`/vehicle/${vin}/entry/${entry.id}`)}
            />
          ))}
        </View>
      )}

      <Pressable
        style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
        onPress={() => router.push(`/vehicle/${vin}/add`)}
      >
        <Text style={styles.addButtonText}>Add to log</Text>
      </Pressable>

      {prior.length > 0 && (
        <View style={styles.priorSection}>
          <Text style={styles.priorHeading}>Before you</Text>
          <Text style={styles.priorIntro}>
            Logged by previous owners. You can read it, but it isn&apos;t yours to change.
          </Text>

          {prior.map((period) => (
            <View key={period.ownershipId} style={styles.period}>
              <Text style={styles.periodOwner}>
                {period.owner.displayName ??
                  (period.owner.handle ? `@${period.owner.handle}` : 'Previous owner')}
              </Text>
              <Text style={styles.periodDates}>
                {period.startedOn} → {period.endedOn}
              </Text>

              {period.entries.length === 0 ? (
                <Text style={styles.periodEmpty}>Nothing logged during this period.</Text>
              ) : (
                <View style={styles.periodEntries}>
                  {period.entries.map((entry) => (
                    <EntryCard key={entry.id} entry={entry} />
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      <View style={styles.share}>
        <View style={styles.shareText}>
          <Text style={styles.shareTitle}>
            {isPublic ? 'Passport is public' : 'Passport is private'}
          </Text>
          <Text style={styles.shareBody}>
            {isPublic
              ? `Anyone with the link can see this build. /p/${vin}`
              : 'Only you can see this build log.'}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.shareButton,
            isPublic && styles.shareButtonOn,
            pressed && styles.removePressed,
          ]}
          onPress={togglePublic}
        >
          <Text style={[styles.shareButtonText, isPublic && styles.shareButtonTextOn]}>
            {isPublic ? 'Unpublish' : 'Publish'}
          </Text>
        </Pressable>
      </View>

      {publishError && <Text style={styles.publishError}>{publishError}</Text>}

      <Pressable
        style={({ pressed }) => [styles.sold, pressed && styles.removePressed]}
        onPress={() => setAskingSold(true)}
      >
        <Text style={styles.soldText}>I sold this car</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
        onPress={() => setAskingRemove(true)}
      >
        <Text style={styles.removeText}>Remove from garage</Text>
      </Pressable>
      <Text style={styles.removeHint}>
        Removing deletes the log for good. If you sold the car, use the option above so its
        history survives.
      </Text>

      <ConfirmDialog
        visible={askingSold}
        title="Sold this car?"
        body={`It leaves your garage, but nothing is deleted. Your ${entries.length} ${
          entries.length === 1 ? 'entry stays' : 'entries stay'
        } attached to your ownership, and the next owner inherits them as read-only history.`}
        confirmLabel="Mark as sold"
        onConfirm={handleSold}
        onCancel={() => setAskingSold(false)}
      />

      <ConfirmDialog
        visible={askingRemove}
        title="Delete this car and its log?"
        body="This is permanent and cannot be undone. If you sold the car, cancel and use 'I sold this car' instead so the history survives for the next owner."
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
  content: { padding: 20, paddingBottom: 40, ...column },

  title: { color: colors.text, fontSize: 26, fontWeight: '700' },
  trim: { color: colors.textMuted, fontSize: 16, marginTop: 2 },

  plate: {
    marginTop: 24,
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    padding: 20,
  },

  gallerySection: { marginTop: 32 },

  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 32,
    marginBottom: 12,
  },
  logTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  logCount: { color: colors.textFaint, fontSize: 13 },

  empty: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 6,
    padding: 20,
  },
  emptyText: { color: colors.textFaint, fontSize: 14, lineHeight: 20 },

  entries: { gap: 10 },

  addButton: {
    backgroundColor: colors.accent,
    borderRadius: 4,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  addButtonPressed: { opacity: 0.8 },
  addButtonText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },

  share: {
    marginTop: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  shareText: { flex: 1, gap: 3 },
  shareTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  shareBody: { color: colors.textFaint, fontSize: 13, lineHeight: 18 },
  shareButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 4,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  shareButtonOn: { backgroundColor: colors.accent },
  shareButtonText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  shareButtonTextOn: { color: colors.background },
  publishError: { color: colors.accent, fontSize: 13, marginTop: 10 },

  priorSection: { marginTop: 36 },
  priorHeading: { color: colors.text, fontSize: 18, fontWeight: '700' },
  priorIntro: { color: colors.textFaint, fontSize: 13, marginTop: 4, lineHeight: 18 },
  period: {
    marginTop: 16,
    paddingLeft: 14,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  periodOwner: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  periodDates: {
    color: colors.textFaint,
    fontSize: 12,
    fontFamily: mono,
    marginTop: 2,
    marginBottom: 10,
  },
  periodEmpty: { color: colors.textFaint, fontSize: 13, marginBottom: 4 },
  periodEntries: { gap: 10 },

  sold: {
    marginTop: 28,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
  },
  soldText: { color: colors.text, fontSize: 14, fontWeight: '600' },

  remove: { marginTop: 18, paddingVertical: 12, alignItems: 'center' },
  removePressed: { opacity: 0.6 },
  removeText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  removeHint: {
    color: colors.textFaint,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 16,
  },

  missing: { color: colors.textMuted, fontSize: 15, padding: 20 },
});
