/**
 * Member pages: /u/handle. Who someone is on Sonder, and the cars they've
 * chosen to publish.
 *
 * Readable without an account, like a passport, but only for members who
 * have published something -- the same rule that decides whether a visitor
 * can read a profile at all (0003). Meets stay members-only here as
 * everywhere else.
 */

import { supabase } from './supabase';
import { loadGalleries } from './photos';
import { toDecodedVehicle, VEHICLE_COLUMNS } from './passport';
import type { DecodedVehicle } from './vin';

export type MemberCar = {
  vehicleId: string;
  vehicle: DecodedVehicle;
  startedOn: string;
  forSale: boolean;
  photoUrl?: string;
  photoThumbUrl?: string;
};

export type MemberMeet = { id: string; title: string; place: string; startsAt: string };

export type Member = {
  id: string;
  handle: string;
  displayName?: string;
  region?: string;
  cars: MemberCar[];
  /** Upcoming meets they host. Empty for visitors, who can't read meets. */
  meets: MemberMeet[];
};

type CarRow = {
  id: string;
  started_on: string;
  for_sale: boolean;
  vehicles: Parameters<typeof toDecodedVehicle>[0];
};

/** A member by handle, or null if there's nobody to show. */
export async function loadMember(handle: string): Promise<Member | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, handle, display_name, region')
    .eq('handle', handle.toLowerCase())
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!profile?.handle) return null;

  const { data: auth } = await supabase.auth.getUser();

  const [cars, meets] = await Promise.all([
    supabase
      .from('ownerships')
      .select(`id, started_on, for_sale, vehicles!inner (${VEHICLE_COLUMNS})`)
      .eq('owner_id', profile.id)
      .eq('is_public', true)
      .is('ended_on', null)
      .order('started_on', { ascending: false }),
    auth.user
      ? supabase
          .from('meets')
          .select('id, title, place, starts_at')
          .eq('host_id', profile.id)
          .is('hidden_at', null)
          .gte('starts_at', new Date().toISOString())
          .order('starts_at')
          .limit(5)
      : null,
  ]);

  if (cars.error) throw new Error(cars.error.message);
  if (meets?.error) throw new Error(meets.error.message);

  const carRows = cars.data as unknown as CarRow[];
  const galleries = await loadGalleries(carRows.map((row) => row.id));

  return {
    id: profile.id,
    handle: profile.handle,
    displayName: profile.display_name ?? undefined,
    region: profile.region ?? undefined,
    cars: carRows.map((row) => {
      const photo = galleries.get(row.id)?.[0];
      return {
        vehicleId: row.vehicles.id,
        vehicle: toDecodedVehicle(row.vehicles),
        startedOn: row.started_on,
        forSale: row.for_sale,
        photoUrl: photo?.url,
        photoThumbUrl: photo?.thumbUrl,
      };
    }),
    meets: ((meets?.data ?? []) as { id: string; title: string; place: string; starts_at: string }[]).map(
      (m) => ({ id: m.id, title: m.title, place: m.place, startsAt: m.starts_at })
    ),
  };
}
