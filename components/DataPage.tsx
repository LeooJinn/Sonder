import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { DecodedVehicle } from '../lib/vin';
import { colors, fonts, radius, type } from '../lib/theme';

/** "2.0L 4-cyl Gasoline", skipping any pieces vPIC didn't return. */
export function engineLine(v: DecodedVehicle): string {
  return [
    v.displacement ? `${Number(v.displacement).toFixed(1)}L` : '',
    v.cylinders ? `${v.cylinders}-cyl` : '',
    v.fuelType,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * vPIC answers in its own vocabulary: "FWD/Front-Wheel Drive",
 * "Hatchback/Liftback/Notchback", "Manual/Standard". People say "front-wheel
 * drive", "hatchback" and "manual", so keep the plainest part.
 *
 * Where vPIC gives an abbreviation people actually use — "Sport Utility
 * Vehicle [SUV]" — that is the plainest part, so it wins. Otherwise words
 * are lowercased into a sentence, except ones already in capitals.
 */
function plain(value: string, part: 'first' | 'last'): string {
  if (!value) return '';
  const pieces = value.split('/');
  const picked = (part === 'first' ? pieces[0] : pieces[pieces.length - 1]).trim();

  // vPIC has written these both as "(SUV)" and as "[SUV]".
  const abbreviation = picked.match(/[([]([A-Z0-9]{2,})[)\]]/);
  if (abbreviation) return abbreviation[1];

  return picked
    .split(' ')
    .map((word, i) => {
      if (/^[A-Z0-9-]{2,}$/.test(word)) return word;
      const lower = word.toLowerCase();
      return i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    })
    .join(' ');
}

/** "SHH FK8G72 KU201847": maker, description, serial — the VIN's own sections. */
export function groupVin(vin: string): string {
  return `${vin.slice(0, 3)} ${vin.slice(3, 9)} ${vin.slice(9)}`;
}

const MRZ_LENGTH = 36;

/**
 * The machine-readable strip along the foot of a passport, rewritten for a
 * car. Line one names it, line two carries the VIN and year. Filler is "<",
 * exactly as on the real thing, and the strip is regenerated from the vehicle
 * each time rather than stored, so it can never disagree with it.
 */
export function mrzLines(v: DecodedVehicle): [string, string] {
  const clean = (s: string) =>
    s
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '<')
      .replace(/^<|<$/g, '');
  const pad = (s: string) => s.padEnd(MRZ_LENGTH, '<').slice(0, MRZ_LENGTH);
  const city = v.plant.split(',')[0] ?? '';

  return [
    pad(`V<SDR${clean(v.make)}<<${clean([v.model, v.trim].filter(Boolean).join(' '))}`),
    pad(`${v.vin}<${v.year}<${clean(city)}`),
  ];
}

/**
 * B612 Mono's advance width as a fraction of its size. The strip is sized to
 * fill its width exactly, like printed type on a page, rather than wrapping.
 */
const MONO_ADVANCE = 0.66;

function Mrz({ vehicle }: { vehicle: DecodedVehicle }) {
  const [width, setWidth] = useState(0);
  const fontSize = width ? Math.min(15, width / (MRZ_LENGTH * MONO_ADVANCE)) : 0;
  const lines = mrzLines(vehicle);

  return (
    <View
      style={styles.mrz}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width - 40)}
      // Screen readers would spell out every "<". The VIN is already
      // announced properly in the spec grid above.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {fontSize > 0 &&
        lines.map((line) => (
          <Text
            key={line}
            numberOfLines={1}
            style={[styles.mrzLine, { fontSize, lineHeight: fontSize * 1.5 }]}
          >
            {line}
          </Text>
        ))}
    </View>
  );
}

function Spec({ label, value, wide, isMono }: { label: string; value: string; wide?: boolean; isMono?: boolean }) {
  if (!value) return null;
  return (
    <View style={[styles.spec, wide && styles.specWide]}>
      <Text style={styles.specLabel}>{label}</Text>
      <Text style={[styles.specValue, isMono && styles.specMono]}>{value}</Text>
    </View>
  );
}

/**
 * A car's identity page: the photo, what it is, what the factory built, and
 * who holds it now. Printed on paper so it reads as a document, not a card.
 * Used for the add preview, the vehicle screen and the public passport.
 */
export function DataPage({
  vehicle,
  photoUrl,
  holder,
}: {
  vehicle: DecodedVehicle;
  photoUrl?: string;
  /** "Kept by you since March 2024". Omitted before the car is saved. */
  holder?: string;
}) {
  return (
    <View style={styles.page}>
      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          style={styles.photo}
          resizeMode="cover"
          accessibilityLabel={`Photo of the ${vehicle.year} ${vehicle.make} ${vehicle.model}`}
        />
      ) : null}

      <View style={styles.body}>
        <View style={styles.makeRow}>
          <Text style={styles.make}>{vehicle.make}</Text>
          <Text style={styles.year}>{vehicle.year}</Text>
        </View>
        <Text style={styles.model} accessibilityRole="header">
          {vehicle.model}
        </Text>
        {vehicle.trim ? <Text style={styles.trim}>{vehicle.trim}</Text> : null}

        <View style={styles.specs}>
          <Spec label="VIN" value={groupVin(vehicle.vin)} wide isMono />
          <Spec label="Engine" value={engineLine(vehicle)} />
          <Spec label="Drive" value={plain(vehicle.driveType, 'last')} />
          <Spec label="Gearbox" value={plain(vehicle.transmission, 'first')} />
          <Spec label="Body" value={plain(vehicle.bodyClass, 'first')} />
          <Spec label="Built in" value={vehicle.plant} wide />
        </View>

        {holder ? <Text style={styles.holder}>{holder}</Text> : null}
      </View>

      <Mrz vehicle={vehicle} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.paper,
    borderRadius: radius.page,
    overflow: 'hidden',
  },
  photo: { width: '100%', aspectRatio: 3 / 2, backgroundColor: colors.paperShade },
  body: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20 },

  makeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  make: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.inkMuted },
  year: { fontFamily: fonts.mono, fontSize: 15, color: colors.inkMuted },
  model: { ...type.display, color: colors.ink, marginTop: 2 },
  trim: { ...type.body, color: colors.inkMuted, marginTop: 2 },

  specs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.paperLine,
    rowGap: 14,
  },
  spec: { width: '50%', paddingRight: 12 },
  specWide: { width: '100%' },
  specLabel: { ...type.caption, color: colors.inkMuted, marginBottom: 2 },
  specValue: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 22, color: colors.ink },
  specMono: { fontFamily: fonts.mono, fontSize: 15, letterSpacing: 0.5 },

  holder: { ...type.small, color: colors.inkMuted, marginTop: 18 },

  mrz: {
    backgroundColor: colors.paperShade,
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 58,
  },
  mrzLine: { fontFamily: fonts.mono, color: colors.inkMuted, letterSpacing: 0 },
});
