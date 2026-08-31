/**
 * Prior history: what happened to a car before the current owner had it.
 *
 * Read-only by construction. The RLS policies added in 0004 let a current
 * owner select a previous owner's entries but never update or delete them —
 * a history that can be rewritten isn't worth inheriting.
 */

import { supabase } from './supabase';
import { publicUrl, type Photo } from './photos';
import type { EntryKind, LogEntry } from './log';

export type PriorPeriod = {
  ownershipId: string;
  startedOn: string;
  endedOn: string;
  owner: { handle?: string; displayName?: string };
  entries: LogEntry[];
};

type OwnershipRow = {
  id: string;
  started_on: string;
  ended_on: string | null;
  owner_id: string;
  profiles: { handle: string | null; display_name: string | null } | null;
};

type EntryRow = {
  id: string;
  ownership_id: string;
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
  photos: {
    id: string;
    storage_path: string;
    width: number | null;
    height: number | null;
    position: number;
  }[];
};

/**
 * Every closed ownership period for a VIN, most recent first, with its
 * entries. Returns [] when the caller doesn't currently own the car — RLS
 * simply yields no rows rather than erroring.
 */
export async function loadPriorHistory(vin: string): Promise<PriorPeriod[]> {
  const { data: vehicle, error: vehicleError } = await supabase
    .from('vehicles')
    .select('id')
    .eq('vin', vin.toUpperCase())
    .maybeSingle();

  if (vehicleError) throw new Error(vehicleError.message);
  if (!vehicle) return [];

  const { data: ownerships, error: ownershipError } = await supabase
    .from('ownerships')
    .select('id, started_on, ended_on, owner_id, profiles (handle, display_name)')
    .eq('vehicle_id', vehicle.id)
    .not('ended_on', 'is', null)
    .order('started_on', { ascending: false });

  if (ownershipError) throw new Error(ownershipError.message);

  const periods = (ownerships ?? []) as unknown as OwnershipRow[];
  if (periods.length === 0) return [];

  const { data: entryData, error: entriesError } = await supabase
    .from('entries')
    .select(
      `id, ownership_id, kind, title, notes, occurred_on, odometer, cost_cents, created_at,
       parts (brand, name, part_number, cost_cents, position),
       photos (id, storage_path, width, height, position)`
    )
    .in(
      'ownership_id',
      periods.map((period) => period.id)
    )
    .order('occurred_on', { ascending: false });

  if (entriesError) throw new Error(entriesError.message);

  const entries = (entryData ?? []) as unknown as EntryRow[];

  return periods.map((period) => ({
    ownershipId: period.id,
    startedOn: period.started_on,
    endedOn: period.ended_on as string,
    owner: {
      handle: period.profiles?.handle ?? undefined,
      displayName: period.profiles?.display_name ?? undefined,
    },
    entries: entries
      .filter((entry) => entry.ownership_id === period.id)
      .map((entry) => ({
        id: entry.id,
        vehicleVin: vin.toUpperCase(),
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
      })),
  }));
}
