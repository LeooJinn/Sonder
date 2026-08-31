/**
 * Account deletion.
 *
 * Identity is erased; history other people depend on is kept and anonymised.
 * Cars still owned leave with the account. Past ownership periods stay
 * attached to their vehicles with no link back to the person, so a buyer's
 * inherited history survives the seller closing their account.
 */

import { supabase } from './supabase';

const BUCKET = 'photos';

/**
 * Storage paths for photos on cars the user still owns — the ones about to be
 * deleted. Photos on past ownerships are left alone: they belong to a history
 * that is being kept.
 */
async function currentPhotoPaths(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('storage_path, entries!inner(ownerships!inner(owner_id, ended_on))')
    .eq('entries.ownerships.owner_id', userId)
    .is('entries.ownerships.ended_on', null);

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as { storage_path: string }[]).map((row) => row.storage_path);
}

/**
 * Delete the signed-in user's account.
 *
 * Storage first, then the database, then sign out. The order matters: once
 * the rows are gone their storage paths are unrecoverable, and the files
 * would bill forever with nothing pointing at them.
 */
export async function deleteAccount(): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('You need to be signed in.');

  const paths = await currentPhotoPaths(auth.user.id);
  if (paths.length > 0) {
    const { error } = await supabase.storage.from(BUCKET).remove(paths);
    if (error) throw new Error(error.message);
  }

  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw new Error(error.message);

  // The session's user no longer exists; clear it locally so the app doesn't
  // sit holding a token for a deleted account.
  await supabase.auth.signOut();
}
