import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { decodeVin, type DecodedVehicle } from '../lib/vin';
import { addVehicle, CarTakenError } from '../lib/garage';
import { reportClaimedVin } from '../lib/moderation';
import { CarDrawing } from '../components/CarDrawing';
import { DataPage } from '../components/DataPage';
import { Stamp } from '../components/Stamp';
import { VinInput } from '../components/VinInput';
import { Button, Field, Notice } from '../components/ui';
import { colors, column, radius, type } from '../lib/theme';
import { duration, ease, nativeDriver, useReducedMotion } from '../lib/motion';
import { WIDE_BREAKPOINT } from '../components/useWide';

export default function AddVehicleScreen() {
  const [vin, setVin] = useState('');
  const [preview, setPreview] = useState<DecodedVehicle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // From the seller, when the car was sold through Sonder: it brings the log.
  const [code, setCode] = useState('');
  // Set when someone else has this VIN in their garage: offers a report.
  const [taken, setTaken] = useState(false);
  const [reported, setReported] = useState(false);
  // True from the moment the car is saved until we move on: the stamp comes down.
  const [entered, setEntered] = useState(false);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;

  // The one orchestrated moment in the app: the data page rising into place
  // once the factory record comes back. Skipped when reduce motion is on.
  const reveal = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (!preview) {
      reveal.setValue(0);
      return;
    }
    if (reduceMotion) {
      reveal.setValue(1);
      return;
    }
    // A confident arrival that settles, with no overshoot (lib/motion.ts).
    Animated.timing(reveal, {
      toValue: 1,
      duration: duration.focal,
      easing: ease.out,
      useNativeDriver: nativeDriver,
    }).start();
  }, [preview, reveal, reduceMotion]);

  async function handleDecode() {
    if (vin.length !== 17) return;
    setBusy(true);
    setError(null);
    setTaken(false);
    setReported(false);
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
      await addVehicle(preview, code);
      // The car is on the books: stamp the page, hold it a beat so it is seen,
      // then go. (replace, not push: after saving, backing out should return
      // to the garage rather than to this form with a stale VIN still in it.)
      setEntered(true);
    } catch (e) {
      setTaken(e instanceof CarTakenError);
      setError(e instanceof Error ? e.message : 'Could not save that car.');
      setBusy(false);
    }
  }

  async function handleReport() {
    if (!preview) return;
    setBusy(true);
    try {
      await reportClaimedVin(preview.vin);
      setReported(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send that report.');
    } finally {
      setBusy(false);
    }
  }

  const page = preview ? (
    <Animated.View
      style={{
        opacity: reveal,
        transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [32, 0] }) }],
      }}
    >
      <Text style={styles.found}>Is this your car?</Text>
      <DataPage
        vehicle={preview}
        overlay={
          <Stamp
            label="ENTERED"
            note={`SONDER ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}`}
            play={entered}
            onLanded={() => setTimeout(() => router.replace(`/vehicle/${preview.vin}`), 650)}
          />
        }
      />
    </Animated.View>
  ) : null;

  const confirm = preview ? (
    <View>
      <View style={styles.gap}>
        <Field
          label="Transfer code from the seller (optional)"
          value={code}
          onChangeText={setCode}
          placeholder="ABCD-1234-EF56"
          autoCapitalize="characters"
          autoCorrect={false}
        />
      </View>
      <Text style={styles.codeHint}>
        Bought it through Sonder? With the seller&apos;s code you inherit the car&apos;s log.
        Without one you start a fresh log.
      </Text>
      <Button label="Add to garage" onPress={handleSave} busy={busy} style={styles.gap} glint />
      {taken && !reported && (
        <View style={styles.gap}>
          <Text style={styles.codeHint}>
            If this is your car and someone else added it, tell us and we will look into it.
          </Text>
          <Button label="This is my car: report it" variant="quiet" onPress={handleReport} busy={busy} />
        </View>
      )}
      {reported && (
        <View style={styles.gap}>
          <Notice tone="success">Thanks. We will look into it.</Notice>
        </View>
      )}
    </View>
  ) : null;

  // Until the VIN resolves, the right-hand side is an empty bay where the page will go.
  const bay = (
    <View style={styles.bay}>
      <CarDrawing width={280} />
      <Text style={styles.bayTitle}>Your car&apos;s page goes here</Text>
      <Text style={styles.bayBody}>
        Year, make, model, engine and where it was built, from the factory record.
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Add a car' }} />

      <ScrollView contentContainerStyle={[styles.content, wide && styles.contentWide]} keyboardShouldPersistTaps="handled">
        <View style={wide ? styles.split : undefined}>
          <View style={wide ? styles.left : undefined}>
            {wide ? (
              <Text style={styles.title} accessibilityRole="header">
                Add a car
              </Text>
            ) : null}
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
                setTaken(false);
                setReported(false);
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
            ) : null}

            {wide ? confirm : null}
            {!wide ? page : null}
            {!wide ? confirm : null}
          </View>

          {wide ? <View style={styles.right}>{page ?? bay}</View> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 48, ...column },

  contentWide: { maxWidth: 1120, paddingHorizontal: 40, paddingTop: 36 },
  split: { flexDirection: 'row', gap: 64, alignItems: 'flex-start' },
  left: { width: 520 },
  right: { flex: 1, minWidth: 0 },
  title: { ...type.hero, fontSize: 64, lineHeight: 60, color: colors.text, marginBottom: 12 },
  bay: {
    minHeight: 520,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.page,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  bayTitle: { ...type.title, color: colors.text, marginTop: 14, textAlign: 'center' },
  bayBody: { ...type.body, color: colors.textMuted, textAlign: 'center', maxWidth: 320 },
  intro: { ...type.lead, color: colors.textMuted, marginBottom: 24 },
  where: { ...type.small, color: colors.textFaint, marginTop: 20 },
  gap: { marginTop: 24 },
  codeHint: { ...type.small, color: colors.textFaint, marginTop: 8 },
  found: { ...type.heading, color: colors.text, marginTop: 0, marginBottom: 14 },
});
