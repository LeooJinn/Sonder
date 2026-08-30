/**
 * The garage: vehicles the signed-in user currently owns.
 *
 * "Garage" is not a table. It's a query: vehicles where I hold an ownership
 * that hasn't ended. Adding a car creates an ownership; removing one ends it.
 * The vehicle row itself is shared by everyone who has ever owned that VIN
 * and is never deleted.
 *
 * The exported functions match what this module looked like when it was
 * backed by AsyncStorage, so the screens using it did not have to change.
 */

import { supabase } from './supabase';
import { publicUrl } from './photos';
import type { DecodedVehicle } from './vin';

export type SavedVehicle = DecodedVehicle & {
  /** When this owner added the car — the ownership's creation, not the vehicle's. */
  addedAt: string;
  /** Newest build log photo, used as the garage card's cover. */
  coverUrl?: string;
};

/** Postgres columns are snake_case; the app is camelCase. This is the seam. */
type VehicleRow = {
  vin: string;
  year: string | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  body_class: string | null;
  drive_type: string | null;
  cylinders: string | null;
  displacement: string | null;
  fuel_type: string | null;
  transmission: string | null;
  plant: string | null;
};

const VEHICLE_COLUMNS =
  'vin, year, make, model, trim, body_class, drive_type, cylinders, displacement, fuel_type, transmission, plant';

function toSavedVehicle(row: VehicleRow, addedAt: string): SavedVehicle {
  return {
    vin: row.vin,
    year: row.year ?? '',
    make: row.make ?? '',
    model: row.model ?? '',
    trim: row.trim ?? '',
    bodyClass: row.body_class ?? '',
    driveType: row.drive_type ?? '',
    cylinders: row.cylinders ?? '',
    displacement: row.displacement ?? '',
    fuelType: row.fuel_type ?? '',
    transmission: row.transmission ?? '',
    plant: row.plant ?? '',
    addedAt,
  };
}

/** The signed-in user's id. Throws if nobody is signed in. */
async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('You need to be signed in.');
  return data.user.id;
}

/**
 * The current owner's open ownership of a VIN, or null.
 * Exported because the build log needs it to attach entries.
 */
export async function findOwnershipId(vin: string): Promise<string | null> {
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from('ownerships')
    .select('id, vehicles!inner(vin)')
    .eq('owner_id', userId)
    .is('ended_on', null)
    .eq('vehicles.vin', vin)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

/**
 * The newest build log photo for each of the given ownerships, as a map from
 * ownership id to public URL. Used for garage cover images.
 *
 * Fetched separately rather than joined into the garage query: "the single
 * most recent photo per vehicle" is a top-1-per-group problem, which is
 * awkward over PostgREST and trivial in JavaScript at this scale.
 */
async function loadCovers(ownershipIds: string[]): Promise<Map<string, string>> {
  const covers = new Map<string, string>();
  if (ownershipIds.length === 0) return covers;

  const { data, error } = await supabase
    .from('photos')
    .select('storage_path, entries!inner(ownership_id, occurred_on, created_at)')
    .in('entries.ownership_id', ownershipIds);

  if (error) throw new Error(error.message);

  type CoverRow = {
    storage_path: string;
    entries: { ownership_id: string; occurred_on: string; created_at: string };
  };

  const rows = (data ?? []) as unknown as CoverRow[];

  // Newest entry first, so the first row seen for an ownership is its cover.
  rows.sort((a, b) => {
    const byDate = b.entries.occurred_on.localeCompare(a.entries.occurred_on);
    return byDate !== 0 ? byDate : b.entries.created_at.localeCompare(a.entries.created_at);
  });

  for (const row of rows) {
    if (!covers.has(row.entries.ownership_id)) {
      covers.set(row.entries.ownership_id, publicUrl(row.storage_path));
    }
  }

  return covers;
}

/** Every vehicle currently in the garage, newest addition first. */
export async function loadGarage(): Promise<SavedVehicle[]> {
  const userId = await requireUserId();

  // One round trip: ownerships with their vehicle embedded. !inner makes it a
  // real join, so an ownership without a vehicle can't produce a null row.
  const { data, error } = await supabase
    .from('ownerships')
    .select(`id, created_at, vehicles!inner(${VEHICLE_COLUMNS})`)
    .eq('owner_id', userId)
    .is('ended_on', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const covers = await loadCovers(rows.map((row) => row.id));

  return rows.map((row) => ({
    ...toSavedVehicle(row.vehicles as unknown as VehicleRow, row.created_at),
    coverUrl: covers.get(row.id),
  }));
}

/** One vehicle from the garage by VIN, or null if the user doesn't own it. */
export async function findVehicle(vin: string): Promise<SavedVehicle | null> {
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from('ownerships')
    .select(`created_at, vehicles!inner(${VEHICLE_COLUMNS})`)
    .eq('owner_id', userId)
    .is('ended_on', null)
    .eq('vehicles.vin', vin)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return toSavedVehicle(data.vehicles as unknown as VehicleRow, data.created_at);
}

/**
 * Add a vehicle to the garage.
 *
 * Two steps, because the vehicle may already exist — someone else may have
 * owned this car before, or still does. The vehicle row is created only if
 * it's new; the ownership is always the user's own.
 */
export async function addVehicle(vehicle: DecodedVehicle): Promise<SavedVehicle> {
  const userId = await requireUserId();

  if (await findOwnershipId(vehicle.vin)) {
    throw new Error('That vehicle is already in your garage.');
  }

  // upsert on the vin unique constraint: insert if absent, leave alone if
  // present. ignoreDuplicates keeps one owner's decode from overwriting
  // another's, which matters because vehicle rows are shared.
  const { error: vehicleError } = await supabase.from('vehicles').upsert(
    {
      vin: vehicle.vin,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      trim: vehicle.trim,
      body_class: vehicle.bodyClass,
      drive_type: vehicle.driveType,
      cylinders: vehicle.cylinders,
      displacement: vehicle.displacement,
      fuel_type: vehicle.fuelType,
      transmission: vehicle.transmission,
      plant: vehicle.plant,
    },
    { onConflict: 'vin', ignoreDuplicates: true }
  );

  if (vehicleError) throw new Error(vehicleError.message);

  const { data: vehicleRow, error: lookupError } = await supabase
    .from('vehicles')
    .select('id')
    .eq('vin', vehicle.vin)
    .single();

  if (lookupError) throw new Error(lookupError.message);

  const { data: ownership, error: ownershipError } = await supabase
    .from('ownerships')
    .insert({ vehicle_id: vehicleRow.id, owner_id: userId })
    .select('created_at')
    .single();

  if (ownershipError) {
    // The partial unique index fires here if someone else currently owns it.
    if (ownershipError.code === '23505') {
      throw new Error('Someone else currently has that VIN in their garage.');
    }
    throw new Error(ownershipError.message);
  }

  return { ...vehicle, addedAt: ownership.created_at };
}

/**
 * Remove a vehicle from the garage.
 *
 * Deletes the ownership, not the vehicle: the vehicle row belongs to the car,
 * not to you. Entries cascade with the ownership, so the log goes too.
 */
export async function removeVehicle(vin: string): Promise<void> {
  const ownershipId = await findOwnershipId(vin);
  if (!ownershipId) return;

  const { error } = await supabase.from('ownerships').delete().eq('id', ownershipId);
  if (error) throw new Error(error.message);
}
