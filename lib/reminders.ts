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
import {
  knownMileage,
  reminderStatus as statusOn,
  type NewReminder,
  type Reminder,
  type ReminderState,
  type ReminderStatus,
} from './reminderStatus';

export { knownMileage };
export type { NewReminder, Reminder, ReminderState, ReminderStatus };

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

/** The most recent log entry that looks like this job, for pre-filling "last done". */
export function lastMatchingEntry(
  entries: LogEntry[],
  matches: (text: string) => boolean
): LogEntry | undefined {
  return [...entries]
    .filter((e) => matches(`${e.title}. ${e.notes ?? ''}`))
    .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn))[0];
}

/**
 * Where a reminder stands today. The rule itself lives in ./reminderStatus,
 * which has no imports so the database tests can load it on its own.
 */
export function reminderStatus(
  reminder: Reminder,
  mileage: number | undefined,
  onDate: string = today()
): ReminderStatus {
  return statusOn(reminder, mileage, onDate);
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

  // Mileage per car, the way the car's own page works it out: the highest
  // reading in the log or on any of its reminders.
  const ownershipIds = [...new Set(rows.map((r) => r.ownership_id))];
  const { data: readings, error: readingsError } = await supabase
    .from('entries')
    .select('ownership_id, odometer')
    .in('ownership_id', ownershipIds)
    .not('odometer', 'is', null);

  if (readingsError) throw new Error(readingsError.message);
  const readingsOf = new Map<string, { odometer: number }[]>();
  for (const r of readings as { ownership_id: string; odometer: number }[]) {
    readingsOf.set(r.ownership_id, [...(readingsOf.get(r.ownership_id) ?? []), { odometer: r.odometer }]);
  }
  const remindersOf = new Map<string, Reminder[]>();
  for (const row of rows) {
    remindersOf.set(row.ownership_id, [...(remindersOf.get(row.ownership_id) ?? []), toReminder(row)]);
  }

  const worst = new Map<string, { title: string; status: ReminderStatus }>();
  for (const row of rows) {
    const reminder = toReminder(row);
    const known = knownMileage(readingsOf.get(row.ownership_id) ?? [], remindersOf.get(row.ownership_id));
    const status = reminderStatus(reminder, known);
    if (status.state !== 'overdue' && status.state !== 'soon') continue;

    const vin = row.ownerships.vehicles.vin;
    const current = worst.get(vin);
    if (!current || status.urgency < current.status.urgency) worst.set(vin, { title: reminder.title, status });
  }
  return worst;
}

/** Whether the signed-in member gets an email when a reminder comes due (0015). */
export async function loadReminderEmails(): Promise<boolean> {
  const me = await requireUserId();
  const { data, error } = await supabase
    .from('reminder_email_settings')
    .select('enabled')
    .eq('profile_id', me)
    .maybeSingle();
  if (error) throw new Error(error.message);
  // Every profile gets a row; if one somehow has none, the default is on.
  return data?.enabled ?? true;
}

export async function setReminderEmails(enabled: boolean): Promise<void> {
  const me = await requireUserId();
  const { error } = await supabase.from('reminder_email_settings').update({ enabled }).eq('profile_id', me);
  if (error) throw new Error(error.message);
}
