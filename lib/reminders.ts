/**
 * Reminders: what's due next, worked out from the log.
 *
 * Only the interval and when it was last done are stored (see 0010). Whether
 * a reminder is due is computed here, from the car's latest logged odometer
 * and today's date, every time it's shown — so it can never be stale.
 */

import { supabase } from './supabase';
import { findOwnershipId, requireUserId } from './garage';
import { today } from './dates';
import type { LogEntry } from './log';

export type Reminder = {
  id: string;
  title: string;
  everyMiles?: number;
  everyMonths?: number;
  lastDoneOn?: string;
  lastDoneOdometer?: number;
};

export type NewReminder = Omit<Reminder, 'id'>;

export type ReminderState = 'overdue' | 'soon' | 'ok' | 'untracked';

export type ReminderStatus = {
  state: ReminderState;
  /** "Due in 800 mi or 3 months", "Overdue by 2 weeks". */
  text: string;
  /** Sort key: most urgent first. */
  urgency: number;
};

/**
 * True when some phrase of the text mentions `include` without `exclude`.
 * Phrases, because notes list several jobs at once — "engine oil, diff,
 * gearbox" did an oil change, even though the same note mentions a gearbox.
 */
function phrase(include: RegExp, exclude?: RegExp): (text: string) => boolean {
  return (text) =>
    text.split(/[,.;:\n]|\band\b/i).some((p) => include.test(p) && !(exclude && exclude.test(p)));
}

/**
 * Common jobs and typical intervals. These are starting points people edit,
 * not advice: the right interval is in the car's own manual.
 *
 * `matches` finds the last time it was done in an existing log, so setting
 * up a reminder for something already logged doesn't mean typing it in again.
 */
export const PRESETS: (NewReminder & { matches: (text: string) => boolean })[] = [
  { title: 'Oil change', everyMiles: 5000, everyMonths: 6, matches: phrase(/\boil\b/i, /gearbox|transmission|diff|gear oil/i) },
  { title: 'Tire rotation', everyMiles: 7500, matches: phrase(/rotat/i) },
  { title: 'Brake fluid', everyMonths: 24, matches: phrase(/brake fluid/i) },
  { title: 'Engine air filter', everyMiles: 15000, everyMonths: 24, matches: phrase(/air filter/i, /cabin/i) },
  { title: 'Coolant', everyMiles: 60000, everyMonths: 60, matches: phrase(/coolant/i) },
  { title: 'Spark plugs', everyMiles: 60000, matches: phrase(/spark plug/i) },
  { title: 'Transmission fluid', everyMiles: 60000, matches: phrase(/(transmission|gearbox)( fluid| oil)?/i) },
  { title: 'Registration', everyMonths: 12, matches: phrase(/registration|smog/i) },
];

/** Miles and months left before a reminder counts as coming up. */
const SOON_MILES = 500;
const SOON_DAYS = 30;

/** The highest odometer reading anywhere in the log: the car's mileage, as far as Sonder knows. */
export function knownMileage(entries: LogEntry[], reminders: Reminder[] = []): number | undefined {
  const readings = [
    ...entries.map((e) => e.odometer),
    ...reminders.map((r) => r.lastDoneOdometer),
  ].filter((n): n is number => n !== undefined);
  return readings.length ? Math.max(...readings) : undefined;
}

/** The most recent log entry that looks like this job, for pre-filling "last done". */
export function lastMatchingEntry(
  entries: LogEntry[],
  matches: (text: string) => boolean
): LogEntry | undefined {
  return [...entries]
    .filter((e) => matches(`${e.title}. ${e.notes ?? ''}`))
    .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn))[0];
}

function daysBetween(fromIso: string, toIso: string): number {
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** "2026-03-31" plus one month is the last day of April, not 1 May. */
function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

function miles(n: number): string {
  return `${n.toLocaleString('en-US')} mi`;
}

/** 12 days, 3 weeks, 5 months, 2 years: the unit someone would actually say. */
function span(days: number): string {
  if (days < 14) return `${days} ${days === 1 ? 'day' : 'days'}`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  if (days < 730) return `${Math.round(days / 30.44)} months`;
  return `${Math.round(days / 365.25)} years`;
}

/**
 * Where a reminder stands. With both a mileage and a time interval, it's due
 * at whichever comes first — the way a service book reads.
 */
export function reminderStatus(
  reminder: Reminder,
  mileage: number | undefined,
  onDate: string = today()
): ReminderStatus {
  const milesLeft =
    reminder.everyMiles !== undefined && reminder.lastDoneOdometer !== undefined && mileage !== undefined
      ? reminder.lastDoneOdometer + reminder.everyMiles - mileage
      : undefined;
  const daysLeft =
    reminder.everyMonths !== undefined && reminder.lastDoneOn !== undefined
      ? daysBetween(onDate, addMonths(reminder.lastDoneOn, reminder.everyMonths))
      : undefined;

  if (milesLeft === undefined && daysLeft === undefined) {
    return {
      state: 'untracked',
      text: 'Add when it was last done to see when it’s due',
      urgency: Number.MAX_SAFE_INTEGER,
    };
  }

  const overdueMiles = milesLeft !== undefined && milesLeft < 0;
  const overdueDays = daysLeft !== undefined && daysLeft < 0;
  // Scale miles and days onto one axis for sorting: roughly 30 miles a day.
  const urgency = Math.min(milesLeft ?? Infinity, (daysLeft ?? Infinity) * 30);

  if (overdueMiles || overdueDays) {
    const parts = [
      overdueMiles ? miles(-milesLeft!) : '',
      overdueDays ? span(-daysLeft!) : '',
    ].filter(Boolean);
    return { state: 'overdue', text: `Overdue by ${parts.join(' and ')}`, urgency };
  }

  if (milesLeft === 0 || daysLeft === 0) {
    return { state: 'soon', text: 'Due now', urgency };
  }

  const parts = [
    milesLeft !== undefined ? miles(milesLeft) : '',
    daysLeft !== undefined ? span(daysLeft) : '',
  ].filter(Boolean);
  const soon =
    (milesLeft !== undefined && milesLeft <= SOON_MILES) || (daysLeft !== undefined && daysLeft <= SOON_DAYS);
  return { state: soon ? 'soon' : 'ok', text: `Due in ${parts.join(' or ')}`, urgency };
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

type ReminderRow = {
  id: string;
  title: string;
  every_miles: number | null;
  every_months: number | null;
  last_done_on: string | null;
  last_done_odometer: number | null;
};

const COLUMNS = 'id, title, every_miles, every_months, last_done_on, last_done_odometer';

function toReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    title: row.title,
    everyMiles: row.every_miles ?? undefined,
    everyMonths: row.every_months ?? undefined,
    lastDoneOn: row.last_done_on ?? undefined,
    lastDoneOdometer: row.last_done_odometer ?? undefined,
  };
}

function toRow(reminder: Partial<NewReminder>) {
  return {
    title: reminder.title?.trim(),
    every_miles: reminder.everyMiles ?? null,
    every_months: reminder.everyMonths ?? null,
    last_done_on: reminder.lastDoneOn ?? null,
    last_done_odometer: reminder.lastDoneOdometer ?? null,
  };
}

export async function loadReminders(vin: string): Promise<Reminder[]> {
  const ownershipId = await findOwnershipId(vin);
  if (!ownershipId) return [];

  const { data, error } = await supabase
    .from('reminders')
    .select(COLUMNS)
    .eq('ownership_id', ownershipId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data as ReminderRow[]).map(toReminder);
}

export async function addReminder(vin: string, reminder: NewReminder): Promise<Reminder> {
  const ownershipId = await findOwnershipId(vin);
  if (!ownershipId) throw new Error('That car is not in your garage.');

  const { data, error } = await supabase
    .from('reminders')
    .insert({ ownership_id: ownershipId, ...toRow(reminder) })
    .select(COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return toReminder(data as ReminderRow);
}

export async function updateReminder(id: string, reminder: NewReminder): Promise<void> {
  const { error } = await supabase.from('reminders').update(toRow(reminder)).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteReminder(id: string): Promise<void> {
  const { error } = await supabase.from('reminders').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Logging the work resets the clock. Called with the entry's own date and
 * mileage when someone ticks "this took care of" on a log entry.
 */
export async function markDone(ids: string[], on: string, odometer?: number): Promise<void> {
  if (ids.length === 0) return;
  const patch: Record<string, unknown> = { last_done_on: on };
  if (odometer !== undefined) patch.last_done_odometer = odometer;

  const { error } = await supabase.from('reminders').update(patch).in('id', ids);
  if (error) throw new Error(error.message);
}

/**
 * The most pressing reminder on each car in the garage, keyed by VIN, for
 * the garage cards. Cars with nothing coming up are left out.
 */
export async function loadGarageReminders(): Promise<Map<string, { title: string; status: ReminderStatus }>> {
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from('reminders')
    .select(`${COLUMNS}, ownership_id, ownerships!inner (owner_id, ended_on, vehicles!inner (vin))`)
    .eq('ownerships.owner_id', userId)
    .is('ownerships.ended_on', null);

  if (error) throw new Error(error.message);
  const rows = data as unknown as (ReminderRow & {
    ownership_id: string;
    ownerships: { vehicles: { vin: string } };
  })[];
  if (rows.length === 0) return new Map();

  // Mileage per car: the highest odometer reading in each ownership's log.
  const ownershipIds = [...new Set(rows.map((r) => r.ownership_id))];
  const { data: readings, error: readingsError } = await supabase
    .from('entries')
    .select('ownership_id, odometer')
    .in('ownership_id', ownershipIds)
    .not('odometer', 'is', null);

  if (readingsError) throw new Error(readingsError.message);
  const mileage = new Map<string, number>();
  for (const r of readings as { ownership_id: string; odometer: number }[]) {
    mileage.set(r.ownership_id, Math.max(mileage.get(r.ownership_id) ?? 0, r.odometer));
  }

  const worst = new Map<string, { title: string; status: ReminderStatus }>();
  for (const row of rows) {
    const reminder = toReminder(row);
    const known = Math.max(mileage.get(row.ownership_id) ?? 0, reminder.lastDoneOdometer ?? 0) || undefined;
    const status = reminderStatus(reminder, known);
    if (status.state !== 'overdue' && status.state !== 'soon') continue;

    const vin = row.ownerships.vehicles.vin;
    const current = worst.get(vin);
    if (!current || status.urgency < current.status.urgency) worst.set(vin, { title: reminder.title, status });
  }
  return worst;
}
