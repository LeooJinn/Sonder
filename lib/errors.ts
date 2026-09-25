/**
 * Turning failures into sentences a person can act on.
 *
 * A fetch that never reaches the server surfaces as "Failed to fetch",
 * "Network request failed" or supabase-js's own "Something went wrong" —
 * none of which tells anyone what to do. Everything else is a message from
 * the database or from Sonder itself, and is already written for people.
 */
export function describeError(error: unknown, fallback = 'That did not work. Try again.'): string {
  const message = error instanceof Error ? error.message : '';
  if (!message) return fallback;
  if (/failed to fetch|network request failed|something went wrong|load failed|timed? ?out/i.test(message)) {
    return "Sonder couldn't reach its server. Check your connection, then try again.";
  }
  return message;
}
