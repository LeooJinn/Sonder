/**
 * Calendar dates, as "YYYY-MM-DD".
 *
 * Deliberately not derived from toISOString(), which converts to UTC first.
 * For someone in Pacific time an evening action lands on tomorrow's date,
 * so a car sold on Saturday night is recorded as sold on Sunday. Dates in
 * Sonder are the ones a person would write down, not instants in time.
 */

/** Today in the device's own timezone. */
export function today(): string {
  return toDateString(new Date());
}

/** A Date rendered as a local calendar date. */
export function toDateString(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * "12 Aug 2026" from "2026-08-12". Reads the string rather than parsing it
 * into a Date, which would shift it into UTC and sometimes onto another day.
 */
export function formatDay(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${Number(day)} ${MONTHS[Number(month) - 1].slice(0, 3)} ${year}`;
}

/** "March 2024" from "2024-03-14" or a full timestamp. */
export function formatMonthYear(iso: string): string {
  const [year, month] = iso.slice(0, 10).split('-');
  return `${MONTHS[Number(month) - 1]} ${year}`;
}

/**
 * "today", "yesterday", "3 days ago", "5 weeks ago", then the month. For
 * when something happened, where the exact date matters less than how fresh
 * it is — a listing, a post.
 */
export function formatAgo(iso: string, now = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `in ${formatMonthYear(iso)}`;
}

/** "1st", "2nd", "3rd", "11th". */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Meets are instants — a start time everyone shares — so unlike the dates
 * above they're parsed into a Date, and shown in the viewer's own timezone.
 */

/** "Saturday 12 October". */
export function formatMeetDay(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Sat", "12", "Oct": the three parts of a calendar sheet. */
export function calendarSheet(iso: string): { weekday: string; day: string; month: string } {
  const d = new Date(iso);
  return {
    weekday: WEEKDAYS[d.getDay()].slice(0, 3),
    day: String(d.getDate()),
    month: MONTHS[d.getMonth()].slice(0, 3),
  };
}

/** "9:30 am", "7 pm". */
export function formatClock(iso: string): string {
  const d = new Date(iso);
  const hours = d.getHours() % 12 || 12;
  const minutes = d.getMinutes();
  const suffix = d.getHours() < 12 ? 'am' : 'pm';
  return minutes === 0 ? `${hours} ${suffix}` : `${hours}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

/**
 * "2026-10-12" and "09:30", read as the viewer's local time, to an ISO
 * instant. Null when either part isn't a real date or time.
 */
export function localDateTimeToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(time)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  if (hours > 23 || minutes > 59) return null;
  const d = new Date(year, month - 1, day, hours, minutes);
  // Date rolls 31 February over into March; a real date survives the trip.
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d.toISOString();
}

/** The next given weekday after today (0 is Sunday), as "YYYY-MM-DD". */
export function nextWeekday(weekday: number, weeksAhead = 0, from = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const days = ((weekday - d.getDay() + 7) % 7 || 7) + weeksAhead * 7;
  d.setDate(d.getDate() + days);
  return toDateString(d);
}
