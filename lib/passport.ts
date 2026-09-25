/**
 * Public passports: a car's history at a shareable link.
 *
 * Everything here is readable without an account, so it must never assume a
 * signed-in user. The queries look almost identical to the private ones — the
 * difference is entirely in which RLS policies let them through.
 */

import { supabase } from './supabase';
import { loadGalleries, type Photo } from './photos';
import { findOwnershipId } from './garage';
import type { DecodedVehicle } from './vin';
import { ENTRY_COLUMNS, toLogEntry, type EntryRow, type LogEntry } from './log';

export type PassportOwner = {
  handle?: string;
  displayName?: string;
  region?: string;
};

/** One owner's time with the car, as a visitor sees it. */
export type PassportChapter = {
  ownershipId: string;
  startedOn: string;
  /** Absent for the current owner. */
  endedOn?: string;
  /**
   * Absent when this owner never published their own period. Their history
   * belongs to the car and is shown; who they are belongs to them and isn't.
   */
  owner?: PassportOwner;
  entries: LogEntry[];
  gallery: Photo[];
};

export type Listing = {
  askingPriceCents?: number;
  contact?: string;
  listedAt: string;
};

export type Passport = {
  vehicle: DecodedVehicle;
  /** Newest first. The first chapter is always the current owner's. */
  chapters: PassportChapter[];
  /** Present when the current owner has the car up for sale. */
  listing?: Listing;
};

type VehicleColumns = {
  id: string;
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

export const VEHICLE_COLUMNS =
  'id, vin, year, make, model, trim, body_class, drive_type, cylinders, displacement, fuel_type, transmission, plant';

export function toDecodedVehicle(row: VehicleColumns): DecodedVehicle {
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
  };
}

type ProfileColumns = { handle: string | null; display_name: string | null; region: string | null };

function toOwner(row: ProfileColumns | null): PassportOwner | undefined {
  if (!row) return undefined;
  return {
    handle: row.handle ?? undefined,
    displayName: row.display_name ?? undefined,
    region: row.region ?? undefined,
  };
}

type CurrentRow = {
  id: string;
  for_sale: boolean;
  asking_price_cents: number | null;
  sale_contact: string | null;
  listed_at: string | null;
  vehicles: VehicleColumns;
};

type PeriodRow = {
  id: string;
  started_on: string;
  ended_on: string | null;
  is_public: boolean;
  profiles: ProfileColumns | null;
};

/**
 * Fetch a published passport by VIN, with every owner's time with the car.
 * Returns null when the car's current owner hasn't published — which is also
 * what a caller sees for a VIN that was never on Sonder, so a private car is
 * indistinguishable from a missing one.
 */
export async function loadPassport(vin: string): Promise<Passport | null> {
  // The current, published ownership decides whether there's a passport at
  // all. A sold car's earlier periods may be published too, but they don't
  // make a passport on their own; the person who has the car now does.
  const { data: current, error } = await supabase
    .from('ownerships')
    .select(
      `id, for_sale, asking_price_cents, sale_contact, listed_at,
       vehicles!inner (${VEHICLE_COLUMNS})`
    )
    .eq('is_public', true)
    .is('ended_on', null)
    .eq('vehicles.vin', vin.toUpperCase())
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!current) return null;

  const row = current as unknown as CurrentRow;
  const vehicle = toDecodedVehicle(row.vehicles);

  const { data: periodData, error: periodError } = await supabase
    .from('ownerships')
    .select('id, started_on, ended_on, is_public, profiles (handle, display_name, region)')
    .eq('vehicle_id', row.vehicles.id)
    .order('started_on', { ascending: false });

  if (periodError) throw new Error(periodError.message);

  // The open period first, whatever its start date says, then the past ones
  // newest first. A car bought and logged on the same day would otherwise
  // tie with the sale that preceded it.
  const periods = (periodData as unknown as PeriodRow[]).sort((a, b) => {
    if (!a.ended_on) return -1;
    if (!b.ended_on) return 1;
    return b.started_on.localeCompare(a.started_on);
  });
  const ids = periods.map((p) => p.id);

  const [{ data: entryData, error: entriesError }, galleries] = await Promise.all([
    supabase
      .from('entries')
      .select(`${ENTRY_COLUMNS}, ownership_id`)
      .in('ownership_id', ids)
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false }),
    loadGalleries(ids),
  ]);

  if (entriesError) throw new Error(entriesError.message);
  const entryRows = entryData as unknown as (EntryRow & { ownership_id: string })[];

  const chapters: PassportChapter[] = periods.map((period) => ({
    ownershipId: period.id,
    startedOn: period.started_on,
    endedOn: period.ended_on ?? undefined,
    owner: period.is_public ? toOwner(period.profiles) : undefined,
    entries: entryRows
      .filter((entry) => entry.ownership_id === period.id)
      .map((entry) => toLogEntry(entry, vehicle.vin)),
    gallery: galleries.get(period.id) ?? [],
  }));

  return {
    vehicle,
    chapters,
    listing:
      row.for_sale && row.listed_at
        ? {
            askingPriceCents: row.asking_price_cents ?? undefined,
            contact: row.sale_contact ?? undefined,
            listedAt: row.listed_at,
          }
        : undefined,
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
  if (!ownershipId) throw new Error('That car is not in your garage.');

  const { error } = await supabase
    .from('ownerships')
    .update({ is_public: isPublic })
    .eq('id', ownershipId);

  if (error) throw new Error(error.message);
}
