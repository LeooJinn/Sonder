/**
 * Public passports: a car's history at a shareable link.
 *
 * Everything here is readable without an account, so it must never assume a
 * signed-in user. The queries look almost identical to the private ones — the
 * difference is entirely in which RLS policies let them through.
 */

import { supabase } from './supabase';
import { publicUrl, type Photo } from './photos';
import { findOwnershipId } from './garage';
import type { DecodedVehicle } from './vin';
import type { LogEntry, EntryKind } from './log';

export type Passport = {
  vehicle: DecodedVehicle;
  entries: LogEntry[];
  owner: {
    handle?: string;
    displayName?: string;
    region?: string;
  };
};

type PassportRow = {
  id: string;
  created_at: string;
  is_public: boolean;
  profiles: { handle: string | null; display_name: string | null; region: string | null } | null;
  vehicles: {
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
};

type EntryRow = {
  id: string;
  kind: EntryKind;
  title: string;
  notes: string | null;
  occurred_on: string;
  odometer: number | null;
  cost_cents: number | null;
  created_at: string;
  parts: {
    brand: string;
    name: string;
    part_number: string | null;
    cost_cents: number | null;
    position: number;
  }[];
  photos: { id: string; storage_path: string; width: number | null; height: number | null; position: number }[];
};

/**
 * Fetch a published passport by VIN. Returns null when no published ownership
 * exists for that VIN — which is also what a caller sees for a VIN that was
 * never published, so a private car is indistinguishable from a missing one.
 */
export async function loadPassport(vin: string): Promise<Passport | null> {
  const { data: ownership, error } = await supabase
    .from('ownerships')
    .select(
      `id, created_at, is_public,
       profiles (handle, display_name, region),
       vehicles!inner (vin, year, make, model, trim, body_class, drive_type,
                       cylinders, displacement, fuel_type, transmission, plant)`
    )
    .eq('is_public', true)
    // Only the current ownership. A sold car keeps its previous owners'
    // periods, and those stay published if they ever were — so without this
    // a VIN that has changed hands matches several rows and maybeSingle
    // fails. The partial unique index guarantees at most one open period per
    // vehicle, which is what makes maybeSingle safe here.
    .is('ended_on', null)
    .eq('vehicles.vin', vin.toUpperCase())
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!ownership) return null;

  const row = ownership as unknown as PassportRow;

  const { data: entryData, error: entriesError } = await supabase
    .from('entries')
    .select(
      `id, kind, title, notes, occurred_on, odometer, cost_cents, created_at,
       parts (brand, name, part_number, cost_cents, position),
       photos (id, storage_path, width, height, position)`
    )
    .eq('ownership_id', row.id)
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (entriesError) throw new Error(entriesError.message);

  const entries: LogEntry[] = (entryData as unknown as EntryRow[]).map((entry) => ({
    id: entry.id,
    vehicleVin: row.vehicles.vin,
    kind: entry.kind,
    title: entry.title,
    notes: entry.notes ?? undefined,
    occurredOn: entry.occurred_on,
    odometer: entry.odometer ?? undefined,
    costCents: entry.cost_cents ?? undefined,
    createdAt: entry.created_at,
    parts: [...(entry.parts ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((part) => ({
        brand: part.brand,
        name: part.name,
        partNumber: part.part_number ?? undefined,
        costCents: part.cost_cents ?? undefined,
      })),
    photos: [...(entry.photos ?? [])]
      .sort((a, b) => a.position - b.position)
      .map(
        (photo): Photo => ({
          id: photo.id,
          url: publicUrl(photo.storage_path),
          storagePath: photo.storage_path,
          width: photo.width ?? undefined,
          height: photo.height ?? undefined,
        })
      ),
  }));

  return {
    vehicle: {
      vin: row.vehicles.vin,
      year: row.vehicles.year ?? '',
      make: row.vehicles.make ?? '',
      model: row.vehicles.model ?? '',
      trim: row.vehicles.trim ?? '',
      bodyClass: row.vehicles.body_class ?? '',
      driveType: row.vehicles.drive_type ?? '',
      cylinders: row.vehicles.cylinders ?? '',
      displacement: row.vehicles.displacement ?? '',
      fuelType: row.vehicles.fuel_type ?? '',
      transmission: row.vehicles.transmission ?? '',
      plant: row.vehicles.plant ?? '',
    },
    entries,
    owner: {
      handle: row.profiles?.handle ?? undefined,
      displayName: row.profiles?.display_name ?? undefined,
      region: row.profiles?.region ?? undefined,
    },
  };
}

/** Whether the signed-in user has published their passport for this VIN. */
export async function isPassportPublic(vin: string): Promise<boolean> {
  const ownershipId = await findOwnershipId(vin);
  if (!ownershipId) return false;

  const { data, error } = await supabase
    .from('ownerships')
    .select('is_public')
    .eq('id', ownershipId)
    .single();

  if (error) throw new Error(error.message);
  return data.is_public;
}

/** Publish or unpublish the signed-in user's passport for this VIN. */
export async function setPassportPublic(vin: string, isPublic: boolean): Promise<void> {
  const ownershipId = await findOwnershipId(vin);
  if (!ownershipId) throw new Error('That vehicle is not in your garage.');

  const { error } = await supabase
    .from('ownerships')
    .update({ is_public: isPublic })
    .eq('id', ownershipId);

  if (error) throw new Error(error.message);
}
