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
