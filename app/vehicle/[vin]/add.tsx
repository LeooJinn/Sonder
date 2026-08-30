import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { addEntry } from '../../../lib/log';
import { addPhoto } from '../../../lib/photos';
import { EntryForm, type EntryFormValues } from '../../../components/EntryForm';

/** Create a new log entry against this vehicle. */
export default function AddEntryScreen() {
  const { vin } = useLocalSearchParams<{ vin: string }>();
  const router = useRouter();

  async function handleSubmit(values: EntryFormValues) {
    const { newPhotoUris, removedPhotoIds: _unused, ...entry } = values;

    // The entry has to exist before photos can point at it.
    const saved = await addEntry({ ...entry, vehicleVin: vin });

    // Sequentially rather than in parallel: a handful of multi-megabyte
    // uploads at once on cellular is slower than one at a time, and far
    // more likely to time out.
    for (const [index, uri] of newPhotoUris.entries()) {
      await addPhoto(saved.id, uri, index);
    }

    router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Add to log' }} />
      <EntryForm submitLabel="Save entry" onSubmit={handleSubmit} />
    </>
  );
}
