/**
 * Profiles: the person behind a garage.
 *
 * The row is created automatically by a trigger on signup, so this module
 * never has to handle a signed-in user without one. Email and password live
 * in auth.users and are Supabase's to manage — storing a second copy here
 * would just be two sources of truth that eventually disagree.
 */

import { supabase } from './supabase';

export type Profile = {
  id: string;
  /** Unique, URL-safe. Null until the user picks one. */
  handle?: string;
  displayName?: string;
  /** City or region only. Never a precise location. */
  region?: string;
};

type ProfileRow = {
  id: string;
  handle: string | null;
  display_name: string | null;
  region: string | null;
};

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    handle: row.handle ?? undefined,
    displayName: row.display_name ?? undefined,
    region: row.region ?? undefined,
  };
}

/**
 * Handles appear in passport URLs, so they're restricted to characters that
 * survive a URL unescaped, and lowercased so that two people can't take
 * visually identical names.
 */
export function isValidHandle(handle: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(handle);
}

/** The signed-in user's profile. */
export async function loadMyProfile(): Promise<Profile> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('You need to be signed in.');

  const { data, error } = await supabase
    .from('profiles')
    .select('id, handle, display_name, region')
    .eq('id', auth.user.id)
    .single();

  if (error) throw new Error(error.message);
  return toProfile(data as ProfileRow);
}

/** One profile by handle. Used to attribute work on a public passport. */
export async function findProfileByHandle(handle: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, handle, display_name, region')
    .eq('handle', handle.toLowerCase())
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toProfile(data as ProfileRow) : null;
}

/** Update the signed-in user's profile. Only the fields supplied are changed. */
export async function updateMyProfile(patch: Partial<Omit<Profile, 'id'>>): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('You need to be signed in.');

  const columns: Record<string, unknown> = {};

  if (patch.handle !== undefined) {
    const handle = patch.handle.trim().toLowerCase();
    if (handle && !isValidHandle(handle)) {
      throw new Error('Handles are 3 to 20 characters: lowercase letters, numbers, underscores.');
    }
    columns.handle = handle || null;
  }
  if (patch.displayName !== undefined) columns.display_name = patch.displayName.trim() || null;
  if (patch.region !== undefined) columns.region = patch.region.trim() || null;

  if (Object.keys(columns).length === 0) return;

  const { error } = await supabase.from('profiles').update(columns).eq('id', auth.user.id);

  if (error) {
    // The unique index on handle. Worth its own message: "duplicate key value
    // violates unique constraint" means nothing to someone picking a username.
    if (error.code === '23505') {
      throw new Error('That handle is already taken.');
    }
    throw new Error(error.message);
  }
}
