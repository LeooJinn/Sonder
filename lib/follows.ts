/**
 * Following cars and people (see 0012).
 *
 * One-way and unapproved: following something grants no access, only a feed
 * of what was already readable. Counts are public; the list behind a count
 * is visible only to the person it's about.
 */

import { supabase } from './supabase';
import { requireUserId } from './garage';

export type FollowState = { following: boolean; count: number };

export type Follower = { id: string; handle?: string; displayName?: string };

async function signedInId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function count(fn: 'car_follower_count' | 'member_follower_count', arg: Record<string, string>) {
  const { data, error } = await supabase.rpc(fn, arg);
  if (error) throw new Error(error.message);
  return (data as number | null) ?? 0;
}

/** Whether the signed-in member follows this car, and how many people do. */
export async function loadCarFollow(vehicleId: string): Promise<FollowState> {
  const [userId, total] = await Promise.all([signedInId(), count('car_follower_count', { vehicle: vehicleId })]);
  if (!userId) return { following: false, count: total };

  const { data, error } = await supabase
    .from('car_follows')
    .select('vehicle_id')
    .eq('follower_id', userId)
    .eq('vehicle_id', vehicleId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { following: !!data, count: total };
}

export async function loadMemberFollow(profileId: string): Promise<FollowState> {
  const [userId, total] = await Promise.all([signedInId(), count('member_follower_count', { member: profileId })]);
  if (!userId) return { following: false, count: total };

  const { data, error } = await supabase
    .from('member_follows')
    .select('followed_id')
    .eq('follower_id', userId)
    .eq('followed_id', profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { following: !!data, count: total };
}

/**
 * The database refuses a follow it won't allow (a car that isn't published
 * any more, someone who blocked you) as a policy violation. Say what that
 * means rather than showing Postgres's wording.
 */
function refused(error: { code?: string; message: string }, what: string): Error {
  if (error.code === '42501') return new Error(`You can't follow this ${what}.`);
  return new Error(error.message);
}

export async function followCar(vehicleId: string): Promise<void> {
  const followerId = await requireUserId();
  const { error } = await supabase.from('car_follows').insert({ follower_id: followerId, vehicle_id: vehicleId });
  // Following twice isn't worth an error: the first one counted.
  if (error && error.code !== '23505') throw refused(error, 'car');
}

export async function unfollowCar(vehicleId: string): Promise<void> {
  const followerId = await requireUserId();
  const { error } = await supabase
    .from('car_follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('vehicle_id', vehicleId);
  if (error) throw new Error(error.message);
}

export async function followMember(profileId: string): Promise<void> {
  const followerId = await requireUserId();
  const { error } = await supabase.from('member_follows').insert({ follower_id: followerId, followed_id: profileId });
  if (error && error.code !== '23505') throw refused(error, 'member');
}

export async function unfollowMember(profileId: string): Promise<void> {
  const followerId = await requireUserId();
  const { error } = await supabase
    .from('member_follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('followed_id', profileId);
  if (error) throw new Error(error.message);
}

/** People who follow the signed-in member, newest first. Only they can read it. */
export async function loadMyFollowers(): Promise<Follower[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('member_follows')
    .select('follower_id, profiles!member_follows_follower_id_fkey (handle, display_name)')
    .eq('followed_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (
    data as unknown as {
      follower_id: string;
      profiles: { handle: string | null; display_name: string | null } | null;
    }[]
  ).map((row) => ({
    id: row.follower_id,
    handle: row.profiles?.handle ?? undefined,
    displayName: row.profiles?.display_name ?? undefined,
  }));
}
