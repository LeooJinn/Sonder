/**
 * VIN decoding via the NHTSA vPIC API.
 * Free, public, no API key. https://vpic.nhtsa.dot.gov/api/
 */

/** The fields we care about, cleaned up from vPIC's much larger response. */
export type DecodedVehicle = {
  vin: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  bodyClass: string;
  driveType: string;
  cylinders: string;
  displacement: string;
  fuelType: string;
  transmission: string;
  plant: string;
};

/** Raw shape of the one result object vPIC returns. Many more fields exist; these are ours. */
type VpicResult = {
  ModelYear: string;
  Make: string;
  Model: string;
  Trim: string;
  BodyClass: string;
  DriveType: string;
  EngineCylinders: string;
  DisplacementL: string;
  FuelTypePrimary: string;
  TransmissionStyle: string;
  PlantCity: string;
  PlantState: string;
  ErrorCode: string;
  ErrorText: string;
};

const VPIC_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues';

/**
 * A VIN is 17 characters. I, O and Q are excluded from the alphabet
 * precisely because they look like 1 and 0.
 */
export function isValidVinFormat(vin: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin.toUpperCase());
}

/** Turn "LOUISVILLE" + "KENTUCKY" into "Louisville, Kentucky". */
function titleCase(input: string): string {
  return input
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Decode a VIN into a vehicle. Throws if the VIN is malformed,
 * the network fails, or vPIC reports it could not decode.
 */
export async function decodeVin(vin: string): Promise<DecodedVehicle> {
  const cleaned = vin.trim().toUpperCase();

  if (!isValidVinFormat(cleaned)) {
    throw new Error('That is not a valid VIN. It should be 17 characters, no I, O or Q.');
  }

  const response = await fetch(`${VPIC_URL}/${cleaned}?format=json`);

  if (!response.ok) {
    throw new Error('Could not reach the vehicle database. Check your connection.');
  }

  const body = (await response.json()) as { Results: VpicResult[] };
  const result = body.Results[0];

  // vPIC returns 200 OK even for VINs it cannot decode; the real status is in ErrorCode.
  // "0" means clean. Anything else is a partial or failed decode.
  if (result.ErrorCode !== '0') {
    throw new Error('That VIN could not be decoded. Double-check the characters.');
  }

  const plantCity = result.PlantCity ? titleCase(result.PlantCity) : '';
  const plantState = result.PlantState ? titleCase(result.PlantState) : '';

  return {
    vin: cleaned,
    year: result.ModelYear,
    make: titleCase(result.Make),
    model: result.Model,
    trim: result.Trim,
    bodyClass: result.BodyClass,
    driveType: result.DriveType,
    cylinders: result.EngineCylinders,
    displacement: result.DisplacementL,
    fuelType: result.FuelTypePrimary,
    transmission: result.TransmissionStyle,
    plant: [plantCity, plantState].filter(Boolean).join(', '),
  };
}
