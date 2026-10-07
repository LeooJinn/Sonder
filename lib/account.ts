/**
 * The account itself: changing its email and password, and deleting it.
 *
 * Deletion:
 *
 * Identity is erased; history other people depend on is kept and anonymised.
 * Cars still owned leave with the account. Past ownership periods stay
 * attached to their vehicles with no link back to the person, so a buyer's
 * inherited history survives the seller closing their account.
 */

import { supabase } from './supabase';
import { photoObjects } from './photos';

const BUCKET = 'photos';

/**
 * Storage paths for photos on cars the user still owns — the ones about to be
 * deleted. Photos on past ownerships are left alone: they belong to a history
 * that is being kept.
 */
async function currentPhotoPaths(userId: string): Promise<string[]> {
  // Entry photos and gallery photos hang off different columns (0006), so
  // they're found separately. Both must go, with their thumbnails.
  const [entryPhotos, galleryPhotos] = await Promise.all([
    supabase
      .from('photos')
      .select('storage_path, entries!inner(ownerships!inner(owner_id, ended_on))')
      .eq('entries.ownerships.owner_id', userId)
      .is('entries.ownerships.ended_on', null),
    supabase
      .from('photos')
      .select('storage_path, ownerships!inner(owner_id, ended_on)')
      .eq('ownerships.owner_id', userId)
      .is('ownerships.ended_on', null),
  ]);

  if (entryPhotos.error) throw new Error(entryPhotos.error.message);
  if (galleryPhotos.error) throw new Error(galleryPhotos.error.message);
  return [...(entryPhotos.data ?? []), ...(galleryPhotos.data ?? [])].flatMap((row) =>
    photoObjects((row as unknown as { storage_path: string }).storage_path)
  );
}

/**
 * Delete the signed-in user's account.
 *
 * The paths of the files that must go are worked out first, while the rows
 * that name them still exist. Then the database, then the files, then sign
 * out. Database first, because the other way round a failure after the files
 * were gone left cars in the garage whose photos were missing; a failure
 * after the database leaves only files nothing points at, which cost a little
 * and can be swept up, and the account is gone as the person asked.
 */
export async function deleteAccount(): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('You need to be signed in.');

  const paths = await currentPhotoPaths(auth.user.id);

  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw new Error(error.message);

  if (paths.length > 0) {
    // Best effort: the account is already gone, and there is nobody left to
    // tell about a file that could not be removed.
    await supabase.storage.from(BUCKET).remove(paths).catch(() => {});
  }

  // The session's user no longer exists; clear it locally so the app doesn't
  // sit holding a token for a deleted account.
  await supabase.auth.signOut();
}

// ---------------------------------------------------------------------------
// Email and password
// ---------------------------------------------------------------------------

/**
 * Check the password someone typed as their current one, by signing in with
 * it, and return the address it belongs to. Changing the email or password
 * asks for it so that a phone left unlocked and signed in is not enough to
 * take the account over.
 */
async function confirmCurrentPassword(currentPassword: string): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const email = auth.user?.email;
  if (!email) throw new Error('You need to be signed in.');
  if (!currentPassword) throw new Error('Enter your current password.');

  const { error } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (error) {
    if (error.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message)) {
      throw new Error('That is not your current password.');
    }
    throw new Error(error.message);
  }
  return email;
}

/**
 * Ask to change the account's email. Nothing changes yet: Supabase emails a
 * confirmation link (to both addresses when the project asks for that, which
 * it should) and the address changes when it is followed.
 */
export async function changeEmail(currentPassword: string, newEmail: string): Promise<void> {
  const next = newEmail.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) throw new Error('Enter a valid email address.');

  const current = await confirmCurrentPassword(currentPassword);
  if (next.toLowerCase() === current.toLowerCase()) throw new Error('That is already your email.');

  const { error } = await supabase.auth.updateUser({ email: next });
  if (error) throw new Error(error.message);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  if (newPassword.length < 8) throw new Error('Use at least 8 characters for your new password.');
  if (newPassword === currentPassword) throw new Error('Choose a password different from the current one.');

  await confirmCurrentPassword(currentPassword);
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

/**
 * Use the token from a change-email link. With both addresses to confirm,
 * `waitingForOther` is true after the first one: the change completes when the
 * other link is followed too.
 */
export async function confirmEmailChange(
  tokenHash: string
): Promise<{ email?: string; waitingForOther: boolean }> {
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email_change' });
  if (error) throw error;
  return { email: data.user?.email, waitingForOther: Boolean(data.user?.new_email) };
}
