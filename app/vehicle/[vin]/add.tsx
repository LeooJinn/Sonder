import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { addEntry } from '../../../lib/log';
import { EntryForm, type EntryFormValues } from '../../../components/EntryForm';

/** Create a new log entry against this vehicle. */
export default function AddEntryScreen() {
  const { vin } = useLocalSearchParams<{ vin: string }>();
  const router = useRouter();

  async function handleSubmit(values: EntryFormValues) {
    await addEntry({ ...values, vehicleVin: vin });
    router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Add to log' }} />
      <EntryForm submitLabel="Save entry" onSubmit={handleSubmit} />
    </>
  );
}
