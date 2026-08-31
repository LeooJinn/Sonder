import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { findEntry, removeEntry, updateEntry, type LogEntry } from '../../../../lib/log';
import { addPhoto, removePhoto } from '../../../../lib/photos';
import { EntryForm, type EntryFormValues } from '../../../../components/EntryForm';
import { ConfirmDialog } from '../../../../components/ConfirmDialog';
import { colors } from '../../../../lib/theme';

/** Edit or delete an existing log entry. Route: /vehicle/:vin/entry/:id */
export default function EditEntryScreen() {
  const { id } = useLocalSearchParams<{ vin: string; id: string }>();
  const [entry, setEntry] = useState<LogEntry | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [askingDelete, setAskingDelete] = useState(false);
  const router = useRouter();

  useEffect(() => {
    findEntry(id).then((found) => {
      setEntry(found);
      setLoaded(true);
    });
  }, [id]);

  async function handleSubmit(values: EntryFormValues) {
    const { newPhotoUris, removedPhotoIds, ...patch } = values;

    await updateEntry(id, patch);

    // Deletions first, so a failed upload doesn't leave the user looking at
    // photos they thought they had removed.
    for (const photoId of removedPhotoIds) {
      const photo = entry?.photos.find((p) => p.id === photoId);
      if (photo) await removePhoto(photo);
    }

    const startPosition = entry?.photos.length ?? 0;
    for (const [index, uri] of newPhotoUris.entries()) {
      await addPhoto(id, uri, startPosition + index);
    }

    router.back();
  }

  async function handleDelete() {
    await removeEntry(id);
    router.back();
  }

  if (!loaded) return <View style={styles.screen} />;

  if (!entry) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text style={styles.missing}>That entry no longer exists.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Edit entry' }} />

      {/*
        The form is given the existing values and manages its own state from
        there. Because it only reads `initial` when it first mounts, the entry
        must be loaded before it renders — which is why this returns early
        above rather than rendering the form with empty values and filling
        them in later.
      */}
      <EntryForm
        initial={{
          kind: entry.kind,
          title: entry.title,
          occurredOn: entry.occurredOn,
          notes: entry.notes,
          odometer: entry.odometer,
          costCents: entry.costCents,
          parts: entry.parts,
          newPhotoUris: [],
          removedPhotoIds: [],
        }}
        initialPhotos={entry.photos}
        submitLabel="Save changes"
        onSubmit={handleSubmit}
      />

      <Pressable
        style={({ pressed }) => [styles.delete, pressed && styles.deletePressed]}
        onPress={() => setAskingDelete(true)}
      >
        <Text style={styles.deleteText}>Delete entry</Text>
      </Pressable>

      <ConfirmDialog
        visible={askingDelete}
        title="Delete this entry?"
        body={`"${entry.title}" will be removed from this car's history. This cannot be undone.`}
        consequences={
          entry.photos.length > 0
            ? [`${entry.photos.length} ${entry.photos.length === 1 ? 'photo' : 'photos'} deleted`]
            : undefined
        }
        confirmLabel="Delete entry"
        onConfirm={handleDelete}
        onCancel={() => setAskingDelete(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  delete: { paddingVertical: 16, alignItems: 'center' },
  deletePressed: { opacity: 0.6 },
  deleteText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  missing: { color: colors.textMuted, fontSize: 15, padding: 20 },
});
