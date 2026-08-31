import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { decodeVin, type DecodedVehicle } from '../lib/vin';
import { addVehicle } from '../lib/garage';
import { SpecList } from '../components/SpecList';
import { colors, column, mono } from '../lib/theme';

export default function AddVehicleScreen() {
  const [vin, setVin] = useState('');
  const [preview, setPreview] = useState<DecodedVehicle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleDecode() {
    setBusy(true);
    setError(null);
    setPreview(null);

    try {
      setPreview(await decodeVin(vin));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!preview) return;
    setBusy(true);
    setError(null);

    try {
      await addVehicle(preview);
      // replace, not push: after saving, backing out should return to the
      // garage rather than to this form with a stale VIN still in it.
      router.replace(`/vehicle/${preview.vin}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that vehicle.');
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Add a vehicle' }} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Vehicle Identification Number</Text>
        <TextInput
          style={styles.input}
          value={vin}
          onChangeText={(text) => {
            setVin(text.toUpperCase());
            // A new VIN invalidates whatever was decoded before it.
            setPreview(null);
            setError(null);
          }}
          placeholder="17 characters"
          placeholderTextColor={colors.disabled}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={17}
        />
        <Text style={styles.counter}>{vin.length} / 17</Text>

        {!preview && (
          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              (busy || vin.length !== 17) && styles.buttonDisabled,
            ]}
            onPress={handleDecode}
            disabled={busy || vin.length !== 17}
          >
            {busy ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.buttonText}>Decode</Text>
            )}
          </Pressable>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        {preview && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {preview.year} {preview.make} {preview.model}
              </Text>
              {preview.trim ? <Text style={styles.cardTrim}>{preview.trim}</Text> : null}
              <View style={styles.cardSpecs}>
                <SpecList vehicle={preview} />
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                busy && styles.buttonDisabled,
              ]}
              onPress={handleSave}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.buttonText}>Add to garage</Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, ...column },

  label: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    color: colors.text,
    fontSize: 18,
    letterSpacing: 2,
    padding: 14,
    fontFamily: mono,
  },
  counter: { color: colors.textFaint, fontSize: 12, textAlign: 'right', marginTop: 6 },

  button: {
    backgroundColor: colors.accent,
    borderRadius: 4,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonPressed: { opacity: 0.8 },
  buttonDisabled: { backgroundColor: colors.disabled },
  buttonText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },

  error: { color: colors.accent, fontSize: 14, marginTop: 20, lineHeight: 20 },

  card: {
    marginTop: 28,
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    padding: 20,
  },
  cardTitle: { color: colors.text, fontSize: 22, fontWeight: '700' },
  cardTrim: { color: colors.textMuted, fontSize: 15, marginTop: 2 },
  cardSpecs: { marginTop: 18 },
});
