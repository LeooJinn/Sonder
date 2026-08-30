/**
 * The build log: everything that has happened to a vehicle.
 *
 * Every entry for every vehicle lives under a single storage key, mirroring
 * the shape this will take in Postgres — one `entries` table with a
 * vehicle_vin column. Reading one vehicle's log means loading all entries
 * and filtering, which is cheap at this scale and keeps cross-vehicle
 * questions ("everything I spent this year") a filter rather than a scan
 * across many keys.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

/** What kind of event this was. Drives the icon and colour, not the shape. */
export type EntryKind = 'mod' | 'service' | 'repair' | 'milestone';

export const ENTRY_KINDS: EntryKind[] = ['mod', 'service', 'repair', 'milestone'];

export const KIND_LABELS: Record<EntryKind, string> = {
  mod: 'Modification',
  service: 'Service',
  repair: 'Repair',
  milestone: 'Milestone',
};

/** A part fitted as part of an entry. Nested, because a part is never viewed alone. */
export type Part = {
  brand: string;
  name: string;
  partNumber?: string;
  /** Integer cents. Never a decimal — see costCents below. */
  costCents?: number;
};

export type LogEntry = {
  /** Generated UUID. Nothing about an entry is naturally unique. */
  id: string;
  /** Which vehicle this belongs to. The foreign key. */
  vehicleVin: string;
  kind: EntryKind;
  title: string;
  notes?: string;
  /**
   * The day the work happened: "YYYY-MM-DD". A calendar date, not a
   * timestamp — nobody cares that the clutch went in at 14:32.
   * This format sorts correctly as a plain string, which is why it's used.
   */
  occurredOn: string;
  odometer?: number;
  /**
   * Integer cents. Floating point cannot represent most decimals exactly
   * (0.1 + 0.2 === 0.30000000000000004), so money is always stored as a
   * whole number of the smallest unit and formatted for display.
   */
  costCents?: number;
  /** Always an array. Empty, never undefined — callers never have to null-check. */
  parts: Part[];
  /** When the record was created, which is not when the work happened. */
  createdAt: string;
};

/**
 * What a caller supplies when adding an entry: everything except the fields
 * this module generates. Omit<T, K> is the built-in type for "T without K".
 */
export type NewLogEntry = Omit<LogEntry, 'id' | 'createdAt'>;

const STORAGE_KEY = 'sonder.log.v1';

/** Every entry for every vehicle, unsorted. Internal — callers want loadEntries. */
async function loadAll(): Promise<LogEntry[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as LogEntry[];
  } catch {
    // Same policy as the garage: corrupted storage starts clean rather than
    // crashing the app. Losing a log is bad; a permanently unopenable app is worse.
    return [];
  }
}

async function saveAll(entries: LogEntry[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

/**
 * One vehicle's log, newest first.
 *
 * Sorting on occurredOn works as a string comparison because "YYYY-MM-DD" is
 * zero-padded and ordered largest unit first — lexicographic order and
 * chronological order are the same thing. createdAt breaks ties so that two
 * entries logged for the same day keep a stable, sensible order.
 */
export async function loadEntries(vin: string): Promise<LogEntry[]> {
  const all = await loadAll();
  return all
    .filter((entry) => entry.vehicleVin === vin)
    .sort((a, b) => {
      const byDate = b.occurredOn.localeCompare(a.occurredOn);
      return byDate !== 0 ? byDate : b.createdAt.localeCompare(a.createdAt);
    });
}

/** Add an entry. Generates the id and createdAt; the caller supplies the rest. */
export async function addEntry(input: NewLogEntry): Promise<LogEntry> {
  const entry: LogEntry = {
    ...input,
    id: Crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };

  await saveAll([entry, ...(await loadAll())]);
  return entry;
}

/** One entry by id, or null if it no longer exists. */
export async function findEntry(id: string): Promise<LogEntry | null> {
  const all = await loadAll();
  return all.find((entry) => entry.id === id) ?? null;
}

/**
 * Change an existing entry.
 *
 * The patch is Partial<NewLogEntry>, so callers can send only the fields
 * they're changing — and cannot touch id or createdAt, because those record
 * facts about the entry's identity and origin rather than its content.
 */
export async function updateEntry(id: string, patch: Partial<NewLogEntry>): Promise<LogEntry> {
  const all = await loadAll();
  const index = all.findIndex((entry) => entry.id === id);

  if (index === -1) {
    throw new Error('That entry no longer exists.');
  }

  const updated: LogEntry = { ...all[index], ...patch };
  // Build a new array rather than mutating in place — same discipline as
  // React state, and it keeps this function free of side effects on its input.
  await saveAll(all.map((entry, i) => (i === index ? updated : entry)));
  return updated;
}

/** Remove one entry. Silently does nothing if the id isn't found. */
export async function removeEntry(id: string): Promise<void> {
  const all = await loadAll();
  await saveAll(all.filter((entry) => entry.id !== id));
}

/**
 * Remove every entry for a vehicle. Called when the vehicle leaves the garage,
 * so that deleted cars don't leave their history behind in storage forever.
 */
export async function removeEntriesForVehicle(vin: string): Promise<void> {
  const all = await loadAll();
  await saveAll(all.filter((entry) => entry.vehicleVin !== vin));
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

  // Round rather than truncate: 45.675 * 100 is 4567.499... in floating point.
  return Math.round(value * 100);
}
