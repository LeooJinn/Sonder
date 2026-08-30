import { StyleSheet, Text, View } from 'react-native';
import type { DecodedVehicle } from '../lib/vin';
import { colors, mono } from '../lib/theme';

/** "1.5L 3-cyl Gasoline", skipping any pieces vPIC didn't return. */
export function engineLine(v: DecodedVehicle): string {
  return [
    v.displacement ? `${Number(v.displacement).toFixed(1)}L` : '',
    v.cylinders ? `${v.cylinders}-cyl` : '',
    v.fuelType,
  ]
    .filter(Boolean)
    .join(' ');
}

/** One label/value row. Renders nothing when there's no value. */
function Spec({ label, value, isMono }: { label: string; value: string; isMono?: boolean }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, isMono && styles.valueMono]}>{value}</Text>
    </View>
  );
}

/** The spec plate. Used on both the add preview and the vehicle detail screen. */
export function SpecList({ vehicle }: { vehicle: DecodedVehicle }) {
  return (
    <View style={styles.list}>
      <Spec label="VIN" value={vehicle.vin} isMono />
      <Spec label="Engine" value={engineLine(vehicle)} />
      <Spec label="Drive" value={vehicle.driveType} />
      <Spec label="Transmission" value={vehicle.transmission} />
      <Spec label="Body" value={vehicle.bodyClass} />
      <Spec label="Built" value={vehicle.plant} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  row: { gap: 3 },
  label: {
    color: colors.textFaint,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  value: { color: colors.text, fontSize: 15 },
  valueMono: { fontFamily: mono, letterSpacing: 1 },
});
