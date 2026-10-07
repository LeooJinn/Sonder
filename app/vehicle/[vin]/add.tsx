import { useEffect, useRef, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { addEntry, updateEntry } from '../../../lib/log';
import { loadReminders, markDone, type Reminder } from '../../../lib/reminders';
import { addPhoto } from '../../../lib/photos';
import { EntryForm, type EntryFormValues } from '../../../components/EntryForm';

/** Create a new log entry against this vehicle. */
export default function AddEntryScreen() {
  const { vin } = useLocalSearchParams<{ vin: string }>();
  const router = useRouter();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  // What a failed try already did. The entry is saved before its photos go up,
  // so a photo that fails (likely on cellular) leaves the form open on an entry
  // that exists. Saving again must carry on from there, not add a second entry
  // and upload everything twice.
  const savedId = useRef<string | null>(null);
  const uploaded = useRef(new Set<string>());

  // Offered in the form as "this took care of". Not worth blocking the form
  // on: if they don't load, the entry can still be logged.
  useEffect(() => {
    loadReminders(vin).then(setReminders).catch(() => {});
  }, [vin]);

  async function handleSubmit(values: EntryFormValues) {
    const { newPhotoUris, removedPhotoIds: _unused, completes, ...entry } = values;

    // The entry has to exist before photos can point at it. On a retry it
    // does already, so it is brought up to date with what the form says now.
    if (savedId.current) {
      await updateEntry(savedId.current, entry);
    } else {
      savedId.current = (await addEntry({ ...entry, vehicleVin: vin })).id;
    }

    // Sequentially rather than in parallel: a handful of multi-megabyte
    // uploads at once on cellular is slower than one at a time, and far
    // more likely to time out.
    for (const [index, uri] of newPhotoUris.entries()) {
      if (uploaded.current.has(uri)) continue;
      await addPhoto(savedId.current, uri, index);
      uploaded.current.add(uri);
    }

    await markDone(completes, entry.occurredOn, entry.odometer);

    router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Add to log' }} />
      <EntryForm submitLabel="Save entry" onSubmit={handleSubmit} reminders={reminders} />
    </>
  );
}
