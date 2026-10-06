/**
 * What a reminder's status is, worked out from the interval, when it was last
 * done, the car's mileage and a date. Pure: no imports, no clock.
 *
 * The database makes the same decision for the emails about reminders that
 * have come due: reminder_is_due() and known_mileage() in migration 0015
 * mirror `due` and knownMileage() below, and supabase/tests/run.mjs compares
 * them over thousands of generated cases. Change one side and that test goes
 * red. Keep this file free of imports: the test loads it on its own.
 */

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
  /** Overdue, or due today. What the reminder emails fire on. */
  due: boolean;
};

/** Miles and months left before a reminder counts as coming up. */
export const SOON_MILES = 500;
export const SOON_DAYS = 30;

/** The highest odometer reading anywhere in the log: the car's mileage, as far as Sonder knows. */
export function knownMileage(entries: { odometer?: number }[], reminders: Reminder[] = []): number | undefined {
  const readings = [
    ...entries.map((e) => e.odometer),
    ...reminders.map((r) => r.lastDoneOdometer),
  ].filter((n): n is number => n !== undefined);
  return readings.length ? Math.max(...readings) : undefined;
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
export function reminderStatus(reminder: Reminder, mileage: number | undefined, onDate: string): ReminderStatus {
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
      due: false,
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
    return { state: 'overdue', text: `Overdue by ${parts.join(' and ')}`, urgency, due: true };
  }

  if (milesLeft === 0 || daysLeft === 0) {
    return { state: 'soon', text: 'Due now', urgency, due: true };
  }

  const parts = [
    milesLeft !== undefined ? miles(milesLeft) : '',
    daysLeft !== undefined ? span(daysLeft) : '',
  ].filter(Boolean);
  const soon =
    (milesLeft !== undefined && milesLeft <= SOON_MILES) || (daysLeft !== undefined && daysLeft <= SOON_DAYS);
  return { state: soon ? 'soon' : 'ok', text: `Due in ${parts.join(' or ')}`, urgency, due: false };
}
