/**
 * Meets: a time, a place and the cars that turned up.
 *
 * Members only (see 0009). The place is whatever the host types; the app
 * never asks for or shows a map pin, and nothing here is readable without an
 * account.
 */

import { supabase } from './supabase';
import { requireUserId } from './garage';
import { loadBlockedIds } from './moderation';

export type MeetPerson = { id: string; handle?: string; displayName?: string };

export type MeetCar = { vin: string; year?: string; make?: string; model?: string };

export type Attendee = MeetPerson & { car?: MeetCar };

export type Meet = {
  id: string;
  title: string;
  details?: string;
  region: string;
  place: string;
  startsAt: string;
  host: MeetPerson;
  isMine: boolean;
  goingCount: number;
  /** Set when reports took the meet down. Only its host still sees it. */
  hiddenAt?: string;
};

export type MeetDetail = Meet & {
  attendees: Attendee[];
  /** Absent when the signed-in user hasn't said they're going. */
  myRsvp?: { vin?: string };
};

export type NewMeet = {
  title: string;
  details?: string;
  region: string;
  place: string;
  startsAt: string;
};

type ProfileRow = { id: string; handle: string | null; display_name: string | null } | null;

type MeetRow = {
  id: string;
  title: string;
  details: string | null;
  region: string;
  place: string;
  starts_at: string;
  hidden_at: string | null;
  host_id: string;
  profiles: ProfileRow;
  meet_rsvps: { count: number }[];
};

type RsvpRow = {
  profile_id: string;
  profiles: ProfileRow;
  vehicles: { vin: string; year: string | null; make: string | null; model: string | null } | null;
};

function toPerson(id: string, row: ProfileRow): MeetPerson {
  return { id, handle: row?.handle ?? undefined, displayName: row?.display_name ?? undefined };
}

function toMeet(row: MeetRow, userId: string): Meet {
  return {
    id: row.id,
    title: row.title,
    details: row.details ?? undefined,
    region: row.region,
    place: row.place,
    startsAt: row.starts_at,
    host: toPerson(row.host_id, row.profiles),
    isMine: row.host_id === userId,
    goingCount: row.meet_rsvps?.[0]?.count ?? 0,
    hiddenAt: row.hidden_at ?? undefined,
  };
}

const MEET_COLUMNS =
  'id, title, details, region, place, starts_at, hidden_at, host_id, profiles!meets_host_id_fkey (id, handle, display_name), meet_rsvps (count)';

/**
 * Meets that haven't finished, soonest first. "Finished" is generous: a meet
 * stays listed for six hours after it starts, because people look it up on
 * the way there.
 */
export async function loadMeets(region?: string): Promise<Meet[]> {
  const userId = await requireUserId();
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('meets')
    .select(MEET_COLUMNS)
    .gte('starts_at', since)
    .order('starts_at', { ascending: true })
    .limit(100);

  if (region) query = query.eq('region', region);

  const [{ data, error }, blocked] = await Promise.all([query, loadBlockedIds()]);
  if (error) throw new Error(error.message);
  return (data as unknown as MeetRow[])
    .filter((row) => !blocked.has(row.host_id))
    .map((row) => toMeet(row, userId));
}

export async function loadMeet(id: string): Promise<MeetDetail | null> {
  const userId = await requireUserId();

  const [{ data, error }, { data: rsvpData, error: rsvpError }] = await Promise.all([
    supabase.from('meets').select(MEET_COLUMNS).eq('id', id).maybeSingle(),
    supabase
      .from('meet_rsvps')
      .select('profile_id, profiles (handle, display_name), vehicles (vin, year, make, model)')
      .eq('meet_id', id)
      .order('created_at', { ascending: true }),
  ]);

  if (error) throw new Error(error.message);
  if (rsvpError) throw new Error(rsvpError.message);
  if (!data) return null;

  const attendees: Attendee[] = (rsvpData as unknown as RsvpRow[]).map((row) => ({
    ...toPerson(row.profile_id, row.profiles),
    car: row.vehicles
      ? {
          vin: row.vehicles.vin,
          year: row.vehicles.year ?? undefined,
          make: row.vehicles.make ?? undefined,
          model: row.vehicles.model ?? undefined,
        }
      : undefined,
  }));
  const mine = attendees.find((a) => a.id === userId);

  return {
    ...toMeet(data as unknown as MeetRow, userId),
    attendees,
    myRsvp: mine ? { vin: mine.car?.vin } : undefined,
  };
}

export async function createMeet(meet: NewMeet): Promise<string> {
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from('meets')
    .insert({
      host_id: userId,
      title: meet.title.trim(),
      details: meet.details?.trim() || null,
      region: meet.region,
      place: meet.place.trim(),
      starts_at: meet.startsAt,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  // The host is going to their own meet. Saying so shouldn't be a second step.
  await supabase.from('meet_rsvps').insert({ meet_id: data.id, profile_id: userId });
  return data.id;
}

export async function cancelMeet(id: string): Promise<void> {
  const { error } = await supabase.from('meets').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Say you're going, or change which car you're bringing. The car must be one
 * in your garage now; the database checks that, not just this screen.
 */
export async function rsvp(meetId: string, vin?: string): Promise<void> {
  const userId = await requireUserId();

  let vehicleId: string | null = null;
  if (vin) {
    const { data, error } = await supabase.from('vehicles').select('id').eq('vin', vin).single();
    if (error) throw new Error(error.message);
    vehicleId = data.id;
  }

  const { error } = await supabase
    .from('meet_rsvps')
    .upsert({ meet_id: meetId, profile_id: userId, vehicle_id: vehicleId });

  if (error) throw new Error(error.message);
}

export async function cancelRsvp(meetId: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('meet_rsvps')
    .delete()
    .eq('meet_id', meetId)
    .eq('profile_id', userId);
  if (error) throw new Error(error.message);
}
