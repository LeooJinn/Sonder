/**
 * Reporting and blocking (see 0011).
 *
 * A report goes to the people running Sonder and, at three reports from
 * different members, acts on its own. A block only changes what the blocker
 * sees; nobody is told.
 */

import { supabase } from './supabase';
import { requireUserId } from './garage';

export type ReportReason = 'spam' | 'scam' | 'unsafe' | 'other';

export const REPORT_REASONS: { value: ReportReason; label: string; hint: string }[] = [
  { value: 'spam', label: 'Spam', hint: 'Advertising, or nothing to do with cars' },
  { value: 'scam', label: 'Scam or fraud', hint: 'Fake listing, deposit requests, stolen car' },
  { value: 'unsafe', label: 'Unsafe', hint: 'Street racing, threats, a private address' },
  { value: 'other', label: 'Something else', hint: 'Tell us in the note' },
];

export type BlockedMember = { id: string; handle?: string; displayName?: string };

async function report(kind: 'meet' | 'listing', targetId: string, reason: ReportReason, note?: string) {
  const reporterId = await requireUserId();
  const { error } = await supabase.from('reports').insert({
    reporter_id: reporterId,
    target_kind: kind,
    target_id: targetId,
    reason,
    note: note?.trim() || null,
  });

  // Reporting twice isn't an error worth showing: the first one counted.
  if (error && error.code !== '23505') throw new Error(error.message);
}

export const reportMeet = (meetId: string, reason: ReportReason, note?: string) =>
  report('meet', meetId, reason, note);

/** Listings are reported by the ownership that's listed. */
export const reportListing = (ownershipId: string, reason: ReportReason, note?: string) =>
  report('listing', ownershipId, reason, note);

export async function blockMember(profileId: string): Promise<void> {
  const blockerId = await requireUserId();
  const { error } = await supabase.from('blocks').insert({ blocker_id: blockerId, blocked_id: profileId });
  if (error && error.code !== '23505') throw new Error(error.message);
}

export async function unblockMember(profileId: string): Promise<void> {
  const blockerId = await requireUserId();
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', profileId);
  if (error) throw new Error(error.message);
}

/** Everyone the signed-in member has blocked, newest first. */
export async function loadBlocked(): Promise<BlockedMember[]> {
  const blockerId = await requireUserId();
  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id, profiles!blocks_blocked_id_fkey (handle, display_name)')
    .eq('blocker_id', blockerId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (
    data as unknown as {
      blocked_id: string;
      profiles: { handle: string | null; display_name: string | null } | null;
    }[]
  ).map((row) => ({
    id: row.blocked_id,
    handle: row.profiles?.handle ?? undefined,
    displayName: row.profiles?.display_name ?? undefined,
  }));
}

/** Just the ids, for filtering lists. Empty when signed out. */
export async function loadBlockedIds(): Promise<Set<string>> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return new Set();
  return new Set((await loadBlocked()).map((m) => m.id));
}
