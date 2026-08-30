/**
 * The build log: everything that has happened to a vehicle.
 *
 * Entries belong to an OWNERSHIP, not to a vehicle. That is what lets a car's
 * history survive being sold while keeping each owner credited with their own
 * work: the buyer gets a new ownership, and the seller's entries stay attached
 * to the seller's period.
 *
 * Parts are a separate table rather than a nested column, so that "every car
 * running this part" is eventually a query rather than a full scan.
 */

import { supabase } from './supabase';
import { findOwnershipId } from './garage';
import { publicUrl, removePhotosForEntry, type Photo } from './photos';

export type EntryKind = 'mod' | 'service' | 'repair' | 'milestone';

export const ENTRY_KINDS: EntryKind[] = ['mod', 'service', 'repair', 'milestone'];

export const KIND_LABELS: Record<EntryKind, string> = {
  mod: 'Modification',
  service: 'Service',
  repair: 'Repair',
  milestone: 'Milestone',
};

export type Part = {
  brand: string;
  name: string;
  partNumber?: string;
  /** Integer cents. Floating point cannot represent decimals exactly. */
  costCents?: number;
};

export type LogEntry = {
  id: string;
  /** Kept in the app's shape even though the database links via ownership. */
  vehicleVin: string;
  kind: EntryKind;
  title: string;
  notes?: string;
  /** "YYYY-MM-DD": the day the work happened, not when it was recorded. */
  occurredOn: string;
  odometer?: number;
  costCents?: number;
  parts: Part[];
  photos: Photo[];
  createdAt: string;
};

/**
 * What a caller supplies when creating an entry. Photos are excluded because
 * they can't exist until the entry does — they're uploaded afterwards, against
 * the new entry's id.
 */
export type NewLogEntry = Omit<LogEntry, 'id' | 'createdAt' | 'photos'>;

type PartRow = {
  brand: string;
  name: string;
  part_number: string | null;
  cost_cents: number | null;
  position: number;
};

type PhotoRow = {
  id: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  position: number;
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
  parts: PartRow[];
  photos: PhotoRow[];
};

const ENTRY_COLUMNS =
  'id, kind, title, notes, occurred_on, odometer, cost_cents, created_at, parts (brand, name, part_number, cost_cents, position), photos (id, storage_path, width, height, position)';

function toLogEntry(row: EntryRow, vin: string): LogEntry {
  return {
    id: row.id,
    vehicleVin: vin,
    kind: row.kind,
    title: row.title,
    notes: row.notes ?? undefined,
    occurredOn: row.occurred_on,
    odometer: row.odometer ?? undefined,
    costCents: row.cost_cents ?? undefined,
    createdAt: row.created_at,
    parts: [...(row.parts ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((part) => ({
        brand: part.brand,
        name: part.name,
        partNumber: part.part_number ?? undefined,
        costCents: part.cost_cents ?? undefined,
      })),
    photos: [...(row.photos ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((photo) => ({
        id: photo.id,
        url: publicUrl(photo.storage_path),
        storagePath: photo.storage_path,
        width: photo.width ?? undefined,
        height: photo.height ?? undefined,
      })),
  };
}

/** Replace an entry's parts wholesale. Simpler and safer than diffing rows. */
async function replaceParts(entryId: string, parts: Part[]): Promise<void> {
  const { error: deleteError } = await supabase.from('parts').delete().eq('entry_id', entryId);
  if (deleteError) throw new Error(deleteError.message);

  if (parts.length === 0) return;

  const { error: insertError } = await supabase.from('parts').insert(
    parts.map((part, index) => ({
      entry_id: entryId,
      brand: part.brand,
      name: part.name,
      part_number: part.partNumber ?? null,
      cost_cents: part.costCents ?? null,
      position: index,
    }))
  );
  if (insertError) throw new Error(insertError.message);
}

/** One vehicle's log, newest first. Empty if the user doesn't own that VIN. */
export async function loadEntries(vin: string): Promise<LogEntry[]> {
  const ownershipId = await findOwnershipId(vin);
  if (!ownershipId) return [];

  const { data, error } = await supabase
    .from('entries')
    .select(ENTRY_COLUMNS)
    .eq('ownership_id', ownershipId)
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data as unknown as EntryRow[]).map((row) => toLogEntry(row, vin));
}

/** One entry by id. RLS means this returns null for entries you can't reach. */
export async function findEntry(id: string): Promise<LogEntry | null> {
  const { data, error } = await supabase
    .from('entries')
    .select(`${ENTRY_COLUMNS}, ownerships!inner(vehicles!inner(vin))`)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as unknown as EntryRow & { ownerships: { vehicles: { vin: string } } };
  return toLogEntry(row, row.ownerships.vehicles.vin);
}

export async function addEntry(input: NewLogEntry): Promise<LogEntry> {
  const ownershipId = await findOwnershipId(input.vehicleVin);
  if (!ownershipId) throw new Error('That vehicle is not in your garage.');

  const { data, error } = await supabase
    .from('entries')
    .insert({
      ownership_id: ownershipId,
      kind: input.kind,
      title: input.title,
      notes: input.notes ?? null,
      occurred_on: input.occurredOn,
      odometer: input.odometer ?? null,
      cost_cents: input.costCents ?? null,
    })
    .select('id, created_at')
    .single();

  if (error) throw new Error(error.message);

  await replaceParts(data.id, input.parts);

  // Photos are uploaded separately by the caller, against this new id.
  return { ...input, id: data.id, createdAt: data.created_at, photos: [] };
}

/** Change an entry. Callers send only what changed; id and createdAt are fixed. */
export async function updateEntry(id: string, patch: Partial<NewLogEntry>): Promise<void> {
  const columns: Record<string, unknown> = {};
  if (patch.kind !== undefined) columns.kind = patch.kind;
  if (patch.title !== undefined) columns.title = patch.title;
  if (patch.notes !== undefined) columns.notes = patch.notes ?? null;
  if (patch.occurredOn !== undefined) columns.occurred_on = patch.occurredOn;
  if (patch.odometer !== undefined) columns.odometer = patch.odometer ?? null;
  if (patch.costCents !== undefined) columns.cost_cents = patch.costCents ?? null;

  if (Object.keys(columns).length > 0) {
    const { error } = await supabase.from('entries').update(columns).eq('id', id);
    if (error) throw new Error(error.message);
  }

  if (patch.parts !== undefined) {
    await replaceParts(id, patch.parts);
  }
}

/**
 * Remove one entry. Parts and photo rows cascade with it — but the image
 * files in storage do not, so they have to go first.
 */
export async function removeEntry(id: string): Promise<void> {
  await removePhotosForEntry(id);

  const { error } = await supabase.from('entries').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Remove every entry for a vehicle.
 *
 * Deleting the ownership already cascades to entries, so this is belt and
 * braces — kept so callers don't have to know which deletes cascade.
 */
export async function removeEntriesForVehicle(vin: string): Promise<void> {
  const ownershipId = await findOwnershipId(vin);
  if (!ownershipId) return;

  const { data, error: listError } = await supabase
    .from('entries')
    .select('id')
    .eq('ownership_id', ownershipId);
  if (listError) throw new Error(listError.message);

  // Storage objects are invisible to the database, so clear them per entry
  // before the rows disappear and their paths become unrecoverable.
  for (const entry of data ?? []) {
    await removePhotosForEntry(entry.id);
  }

  const { error } = await supabase.from('entries').delete().eq('ownership_id', ownershipId);
  if (error) throw new Error(error.message);
}

/** Today as "YYYY-MM-DD" in the device's local timezone, for date defaults. */
export function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** 45000 -> "$450.00". Display only; storage stays in cents. */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** "450", "450.00", "$450" -> 45000. Returns undefined if it isn't a number. */
export function parseCents(input: string): number | undefined {
  const cleaned = input.replace(/[$,\s]/g, '');
  if (!cleaned) return undefined;

  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return undefined;

  return Math.round(value * 100);
}
