/**
 * The Following feed: what the cars and people a member follows have done,
 * newest first.
 *
 * The database decides which items exist and in what order (my_feed, 0012),
 * under the caller's own row-level security. This module only fills each item
 * in with the rows it points at. An item whose row can't be read by the time
 * it's fetched -- unpublished a second ago, say -- is left out rather than
 * shown half-empty.
 */

import { supabase } from './supabase';
import { requireUserId } from './garage';
import { loadGalleries } from './photos';
import { ENTRY_COLUMNS, toLogEntry, type EntryRow, type LogEntry } from './log';
import { toDecodedVehicle, VEHICLE_COLUMNS } from './passport';
import type { DecodedVehicle } from './vin';

export type FeedPerson = { id: string; handle?: string; displayName?: string; region?: string };

export type FeedCar = {
  vehicleId: string;
  vehicle: DecodedVehicle;
  photoUrl?: string;
  photoThumbUrl?: string;
};

type Base = {
  key: string;
  at: string;
  /** Absent when the period isn't published: the passport doesn't name them either. */
  actor?: FeedPerson;
};

export type FeedItem =
  | (Base & { kind: 'entry'; car: FeedCar; entry: LogEntry })
  | (Base & { kind: 'listed'; car: FeedCar; askingPriceCents?: number })
  | (Base & { kind: 'published'; car: FeedCar })
  | (Base & { kind: 'sold'; car: FeedCar; startedOn: string; endedOn: string })
  | (Base & {
      kind: 'meet';
      meet: { id: string; title: string; place: string; region: string; startsAt: string };
    });

export type FeedPage = { items: FeedItem[]; nextBefore?: string };

export const FEED_PAGE = 30;

type FeedRow = {
  kind: FeedItem['kind'];
  at: string;
  ownership_id: string | null;
  vehicle_id: string | null;
  entry_id: string | null;
  meet_id: string | null;
  actor_id: string | null;
};

type OwnershipRow = {
  id: string;
  started_on: string;
  ended_on: string | null;
  asking_price_cents: number | null;
  vehicles: Parameters<typeof toDecodedVehicle>[0];
};

type ProfileRow = { id: string; handle: string | null; display_name: string | null; region: string | null };

type MeetRow = { id: string; title: string; place: string; region: string; starts_at: string };

const unique = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => !!v))];

/** One page of the feed. Pass the previous page's nextBefore for the one after. */
export async function loadFeed(before?: string): Promise<FeedPage> {
  const { data, error } = await supabase.rpc('my_feed', { before: before ?? null, max_items: FEED_PAGE });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as FeedRow[];
  if (rows.length === 0) return { items: [] };

  const ownershipIds = unique(rows.map((r) => r.ownership_id));
  const entryIds = unique(rows.map((r) => r.entry_id));
  const meetIds = unique(rows.map((r) => r.meet_id));
  const actorIds = unique(rows.map((r) => r.actor_id));

  const [ownerships, entries, meets, people, galleries] = await Promise.all([
    ownershipIds.length
      ? supabase
          .from('ownerships')
          .select(`id, started_on, ended_on, asking_price_cents, vehicles!inner (${VEHICLE_COLUMNS})`)
          .in('id', ownershipIds)
      : null,
    entryIds.length ? supabase.from('entries').select(ENTRY_COLUMNS).in('id', entryIds) : null,
    meetIds.length
      ? supabase.from('meets').select('id, title, place, region, starts_at').in('id', meetIds)
      : null,
    actorIds.length
      ? supabase.from('profiles').select('id, handle, display_name, region').in('id', actorIds)
      : null,
    loadGalleries(ownershipIds),
  ]);

  for (const result of [ownerships, entries, meets, people]) {
    if (result?.error) throw new Error(result.error.message);
  }

  const ownershipById = new Map(
    ((ownerships?.data ?? []) as unknown as OwnershipRow[]).map((o) => [o.id, o])
  );
  const entryById = new Map(((entries?.data ?? []) as unknown as EntryRow[]).map((e) => [e.id, e]));
  const meetById = new Map(((meets?.data ?? []) as MeetRow[]).map((m) => [m.id, m]));
  const personById = new Map(
    ((people?.data ?? []) as ProfileRow[]).map((p) => [
      p.id,
      {
        id: p.id,
        handle: p.handle ?? undefined,
        displayName: p.display_name ?? undefined,
        region: p.region ?? undefined,
      },
    ])
  );

  const items: FeedItem[] = [];
  for (const row of rows) {
    const actor = row.actor_id ? personById.get(row.actor_id) : undefined;
    const key = `${row.kind}:${row.entry_id ?? row.meet_id ?? row.ownership_id}`;

    if (row.kind === 'meet') {
      const meet = row.meet_id ? meetById.get(row.meet_id) : undefined;
      if (!meet) continue;
      items.push({
        kind: 'meet',
        key,
        at: row.at,
        actor,
        meet: { id: meet.id, title: meet.title, place: meet.place, region: meet.region, startsAt: meet.starts_at },
      });
      continue;
    }

    const ownership = row.ownership_id ? ownershipById.get(row.ownership_id) : undefined;
    if (!ownership) continue;
    const vehicle = toDecodedVehicle(ownership.vehicles);
    const photo = galleries.get(ownership.id)?.[0];
    const car: FeedCar = {
      vehicleId: ownership.vehicles.id,
      vehicle,
      photoUrl: photo?.url,
      photoThumbUrl: photo?.thumbUrl,
    };

    switch (row.kind) {
      case 'entry': {
        const entry = row.entry_id ? entryById.get(row.entry_id) : undefined;
        if (entry) items.push({ kind: 'entry', key, at: row.at, actor, car, entry: toLogEntry(entry, vehicle.vin) });
        break;
      }
      case 'listed':
        items.push({
          kind: 'listed',
          key,
          at: row.at,
          actor,
          car,
          askingPriceCents: ownership.asking_price_cents ?? undefined,
        });
        break;
      case 'published':
        items.push({ kind: 'published', key, at: row.at, actor, car });
        break;
      case 'sold':
        if (ownership.ended_on) {
          items.push({
            kind: 'sold',
            key,
            at: row.at,
            actor,
            car,
            startedOn: ownership.started_on,
            endedOn: ownership.ended_on,
          });
        }
        break;
    }
  }

  return {
    items,
    // A full page means there may be more. Page by the database's own
    // timestamps, not by what survived filling in.
    nextBefore: rows.length === FEED_PAGE ? rows[rows.length - 1].at : undefined,
  };
}

/** Whether anything in the feed is newer than the member's last look. */
export async function hasNewInFeed(): Promise<boolean> {
  const userId = await requireUserId();
  const [{ data: newest, error }, { data: me, error: meError }] = await Promise.all([
    supabase.rpc('my_feed', { before: null, max_items: 1 }),
    supabase.from('profiles').select('feed_seen_at').eq('id', userId).single(),
  ]);
  if (error) throw new Error(error.message);
  if (meError) throw new Error(meError.message);

  const latest = (newest as FeedRow[] | null)?.[0]?.at;
  if (!latest) return false;
  const seen = (me as { feed_seen_at: string | null }).feed_seen_at;
  return !seen || new Date(latest) > new Date(seen);
}

export async function markFeedSeen(): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('profiles')
    .update({ feed_seen_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}

export type SuggestedCar = FeedCar & { owner: FeedPerson; publishedAt?: string };

type SuggestionRow = {
  id: string;
  owner_id: string;
  published_at: string | null;
  vehicles: Parameters<typeof toDecodedVehicle>[0];
  profiles: ProfileRow;
};

/**
 * Something to follow when the feed is empty: cars recently published near
 * the member, or anywhere if nothing near them is. Their own cars and ones
 * they already follow are left out.
 */
export async function loadSuggestions(region?: string): Promise<SuggestedCar[]> {
  const userId = await requireUserId();

  const query = async (inRegion?: string) => {
    let q = supabase
      .from('ownerships')
      .select(
        `id, owner_id, published_at,
         vehicles!inner (${VEHICLE_COLUMNS}),
         profiles!inner (id, handle, display_name, region)`
      )
      .eq('is_public', true)
      .is('ended_on', null)
      .neq('owner_id', userId)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(24);
    if (inRegion) q = q.eq('profiles.region', inRegion);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data as unknown as SuggestionRow[];
  };

  const [{ data: followed, error }, { data: blockedRows }] = await Promise.all([
    supabase.from('car_follows').select('vehicle_id').eq('follower_id', userId),
    supabase.from('blocks').select('blocked_id').eq('blocker_id', userId),
  ]);
  if (error) throw new Error(error.message);
  const skip = new Set((followed ?? []).map((f: { vehicle_id: string }) => f.vehicle_id));
  const blocked = new Set((blockedRows ?? []).map((b: { blocked_id: string }) => b.blocked_id));

  let rows = region ? await query(region) : [];
  const fresh = (list: SuggestionRow[]) =>
    list.filter((r) => !skip.has(r.vehicles.id) && !blocked.has(r.owner_id));
  if (fresh(rows).length === 0) rows = await query();
  rows = fresh(rows).slice(0, 8);

  const galleries = await loadGalleries(rows.map((r) => r.id));
  return rows.map((row) => {
    const photo = galleries.get(row.id)?.[0];
    return {
      vehicleId: row.vehicles.id,
      vehicle: toDecodedVehicle(row.vehicles),
      photoUrl: photo?.url,
      photoThumbUrl: photo?.thumbUrl,
      publishedAt: row.published_at ?? undefined,
      owner: {
        id: row.profiles.id,
        handle: row.profiles.handle ?? undefined,
        displayName: row.profiles.display_name ?? undefined,
        region: row.profiles.region ?? undefined,
      },
    };
  });
}
