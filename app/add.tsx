import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { decodeVin, type DecodedVehicle } from '../lib/vin';
import { addVehicle } from '../lib/garage';
import { DataPage } from '../components/DataPage';
import { VinInput } from '../components/VinInput';
import { Button, Notice } from '../components/ui';
import { colors, column, type } from '../lib/theme';

export default function AddVehicleScreen() {
  const [vin, setVin] = useState('');
  const [preview, setPreview] = useState<DecodedVehicle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  // The one orchestrated moment in the app: the data page rising into place
  // once the factory record comes back. Skipped when reduce motion is on.
  const reveal = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!preview) {
      reveal.setValue(0);
      return;
    }
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) {
        reveal.setValue(1);
        return;
      }
      Animated.spring(reveal, {
        toValue: 1,
        damping: 18,
        stiffness: 140,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    });
  }, [preview, reveal]);

  async function handleDecode() {
    if (vin.length !== 17) return;
    setBusy(true);
    setError(null);
    setPreview(null);

    try {
      setPreview(await decodeVin(vin));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The lookup failed. Try again.');
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
      setError(e instanceof Error ? e.message : 'Could not save that car.');
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Add a car' }} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          Enter the car&apos;s VIN and Sonder fills in the rest from the factory record.
        </Text>

        <VinInput
          value={vin}
          onChange={(next) => {
            setVin(next);
            // A new VIN invalidates whatever was looked up before it.
            if (preview) setPreview(null);
            setError(null);
          }}
          onSubmit={handleDecode}
        />

        <Text style={styles.where}>
          Find it on the driver&apos;s side of the dashboard, readable through the windshield,
          or on the sticker inside the driver&apos;s door.
        </Text>

        {error ? (
          <View style={styles.gap}>
            <Notice tone="error">{error}</Notice>
          </View>
        ) : null}

        {!preview ? (
          <Button
            label={vin.length === 17 ? 'Look up this VIN' : `${17 - vin.length} characters to go`}
            onPress={handleDecode}
            busy={busy}
            disabled={vin.length !== 17}
            style={styles.gap}
          />
        ) : (
          <Animated.View
            style={{
              opacity: reveal,
              transform: [
                { translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [32, 0] }) },
              ],
            }}
          >
            <Text style={styles.found}>Is this your car?</Text>
            <DataPage vehicle={preview} />
            <Button label="Add to garage" onPress={handleSave} busy={busy} style={styles.gap} />
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 48, ...column },

  intro: { ...type.lead, color: colors.textMuted, marginBottom: 24 },
  where: { ...type.small, color: colors.textFaint, marginTop: 20 },
  gap: { marginTop: 24 },
  found: { ...type.heading, color: colors.text, marginTop: 32, marginBottom: 14 },
});
