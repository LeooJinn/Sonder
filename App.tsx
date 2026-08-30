import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { decodeVin, type DecodedVehicle } from './lib/vin';

export default function App() {
  // Three pieces of state. React re-renders this component whenever any of them changes.
  const [vin, setVin] = useState('');
  const [vehicle, setVehicle] = useState<DecodedVehicle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleDecode() {
    setLoading(true);
    setError(null);
    setVehicle(null);

    try {
      const result = await decodeVin(vin);
      setVehicle(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      // Runs whether we succeeded or threw, so the spinner always stops.
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.wordmark}>SONDER</Text>
          <Text style={styles.tagline}>Every car has a life of its own.</Text>

          <Text style={styles.label}>Vehicle Identification Number</Text>
          <TextInput
            style={styles.input}
            value={vin}
            onChangeText={(text) => setVin(text.toUpperCase())}
            placeholder="17 characters"
            placeholderTextColor="#4A5A69"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={17}
          />
          <Text style={styles.counter}>{vin.length} / 17</Text>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              (loading || vin.length !== 17) && styles.buttonDisabled,
            ]}
            onPress={handleDecode}
            disabled={loading || vin.length !== 17}
          >
            {loading ? (
              <ActivityIndicator color="#12181F" />
            ) : (
              <Text style={styles.buttonText}>Decode</Text>
            )}
          </Pressable>

          {error && <Text style={styles.error}>{error}</Text>}

          {vehicle && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {vehicle.year} {vehicle.make} {vehicle.model}
              </Text>
              {vehicle.trim ? <Text style={styles.cardTrim}>{vehicle.trim}</Text> : null}

              <View style={styles.plate}>
                <Spec label="VIN" value={vehicle.vin} mono />
                <Spec label="Engine" value={engineLine(vehicle)} />
                <Spec label="Drive" value={vehicle.driveType} />
                <Spec label="Transmission" value={vehicle.transmission} />
                <Spec label="Body" value={vehicle.bodyClass} />
                <Spec label="Built" value={vehicle.plant} />
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** "1.5L 3-cyl Gasoline", skipping any pieces vPIC didn't return. */
function engineLine(v: DecodedVehicle): string {
  const parts = [
    v.displacement ? `${Number(v.displacement).toFixed(1)}L` : '',
    v.cylinders ? `${v.cylinders}-cyl` : '',
    v.fuelType,
  ];
  return parts.filter(Boolean).join(' ');
}

/** One label/value row. Renders nothing if there's no value. */
function Spec({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <View style={styles.specRow}>
      <Text style={styles.specLabel}>{label}</Text>
      <Text style={[styles.specValue, mono && styles.specMono]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: '#12181F' },
  content: { padding: 24, paddingTop: 48, gap: 8 },

  wordmark: {
    color: '#E6E9EC',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 6,
  },
  tagline: {
    color: '#8D9BA8',
    fontSize: 15,
    marginBottom: 36,
  },

  label: {
    color: '#8D9BA8',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1A222B',
    borderWidth: 1,
    borderColor: '#2C3742',
    borderRadius: 4,
    color: '#E6E9EC',
    fontSize: 18,
    letterSpacing: 2,
    padding: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  counter: {
    color: '#5C6B7A',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 6,
  },

  button: {
    backgroundColor: '#E0584B',
    borderRadius: 4,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonPressed: { opacity: 0.8 },
  buttonDisabled: { backgroundColor: '#3A444F' },
  buttonText: {
    color: '#12181F',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },

  error: {
    color: '#E0584B',
    fontSize: 14,
    marginTop: 20,
    lineHeight: 20,
  },

  card: {
    marginTop: 32,
    backgroundColor: '#1A222B',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#E0584B',
    padding: 20,
  },
  cardTitle: {
    color: '#E6E9EC',
    fontSize: 24,
    fontWeight: '700',
  },
  cardTrim: {
    color: '#8D9BA8',
    fontSize: 15,
    marginTop: 2,
  },

  plate: { marginTop: 20, gap: 12 },
  specRow: { gap: 3 },
  specLabel: {
    color: '#5C6B7A',
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  specValue: {
    color: '#E6E9EC',
    fontSize: 15,
  },
  specMono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
  },
});
