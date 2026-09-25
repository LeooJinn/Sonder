/**
 * For sale: listing a car, and browsing cars other people have listed.
 *
 * A listing is three columns on the current ownership (see 0008), so every
 * listed car is a published car, and a buyer always lands on its full
 * history. The database takes a car off the market by itself when it's sold,
 * unpublished or its owner's account is deleted.
 */

import { supabase } from './supabase';
import { findOwnershipId } from './garage';
import { loadGalleries } from './photos';
import { toDecodedVehicle, VEHICLE_COLUMNS } from './passport';
import type { DecodedVehicle } from './vin';

export type MyListing = {
  forSale: boolean;
  askingPriceCents?: number;
  contact?: string;
};

export type MarketListing = {
  vehicle: DecodedVehicle;
  askingPriceCents?: number;
  region?: string;
  seller: { handle?: string; displayName?: string };
  listedAt: string;
  photoUrl?: string;
};

/** The signed-in owner's listing for one of their cars. */
export async function loadMyListing(vin: string): Promise<MyListing> {
  const ownershipId = await findOwnershipId(vin);
  if (!ownershipId) return { forSale: false };

  const { data, error } = await supabase
    .from('ownerships')
    .select('for_sale, asking_price_cents, sale_contact')
    .eq('id', ownershipId)
    .single();

  if (error) throw new Error(error.message);
  return {
    forSale: data.for_sale,
    askingPriceCents: data.asking_price_cents ?? undefined,
    contact: data.sale_contact ?? undefined,
  };
}

/**
 * List, update or withdraw a car. The passport must already be public; the
 * database silently refuses to list a private car, so this checks first and
 * says why rather than appearing to succeed.
 */
export async function saveMyListing(vin: string, listing: MyListing): Promise<void> {
  const ownershipId = await findOwnershipId(vin);
  if (!ownershipId) throw new Error('That car is not in your garage.');

  const { data, error } = await supabase
    .from('ownerships')
    .update({
      for_sale: listing.forSale,
      asking_price_cents: listing.askingPriceCents ?? null,
      sale_contact: listing.contact?.trim() || null,
    })
    .eq('id', ownershipId)
    .select('for_sale')
    .single();

  if (error) throw new Error(error.message);
  if (listing.forSale && !data.for_sale) {
    throw new Error('Turn on the public link first. Buyers need to be able to read the history.');
  }
}

type MarketRow = {
  id: string;
  asking_price_cents: number | null;
  listed_at: string;
  vehicles: Parameters<typeof toDecodedVehicle>[0];
  profiles: { handle: string | null; display_name: string | null; region: string | null } | null;
};

/** Cars for sale, newest listing first, optionally only in one region. */
export async function loadMarket(region?: string): Promise<MarketListing[]> {
  let query = supabase
    .from('ownerships')
    .select(
      `id, asking_price_cents, listed_at,
       vehicles!inner (${VEHICLE_COLUMNS}),
       profiles${region ? '!inner' : ''} (handle, display_name, region)`
    )
    .eq('for_sale', true)
    .order('listed_at', { ascending: false })
    .limit(60);

  if (region) query = query.eq('profiles.region', region);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = data as unknown as MarketRow[];
  const galleries = await loadGalleries(rows.map((row) => row.id));

  return rows.map((row) => ({
    vehicle: toDecodedVehicle(row.vehicles),
    askingPriceCents: row.asking_price_cents ?? undefined,
    region: row.profiles?.region ?? undefined,
    seller: {
      handle: row.profiles?.handle ?? undefined,
      displayName: row.profiles?.display_name ?? undefined,
    },
    listedAt: row.listed_at,
    photoUrl: galleries.get(row.id)?.[0]?.url,
  }));
}
