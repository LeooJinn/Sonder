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
