/**
 * Messages between members who follow each other (see 0013).
 *
 * The database decides who may write to whom, what each side can read and
 * when someone is paused; this module asks it and fills the answers in with
 * names and cars. A conversation is one per pair: what's here is the inbox,
 * the thread, sending, and the few ways to leave one.
 */

import { supabase } from './supabase';
import { requireUserId } from './garage';
import { loadGalleries } from './photos';
import { toDecodedVehicle, VEHICLE_COLUMNS } from './passport';
import type { DecodedVehicle } from './vin';

export const MAX_MESSAGE_LENGTH = 2000;

export type MessagePerson = { id: string; handle?: string; displayName?: string };

/** A car attached to a message: a link to its published passport. */
export type MessageCar = {
  vehicleId: string;
  vehicle: DecodedVehicle;
  photoUrl?: string;
  photoThumbUrl?: string;
};

export type Message = {
  id: string;
  senderId: string;
  mine: boolean;
  body: string;
  at: string;
  /** A car was attached. `car` is missing when it has since stopped being public. */
  hasCar: boolean;
  car?: MessageCar;
};

export type InboxItem = {
  conversationId: string;
  /** Missing once they've deleted their account. */
  other?: MessagePerson;
  lastBody: string;
  lastFromMe: boolean;
  lastHasCar: boolean;
  lastAt: string;
  unread: number;
  canReply: boolean;
};

/** Why a conversation can't be added to, in the order it's worth saying. */
export type ClosedReason = 'left' | 'paused' | 'ended';

export type Thread = {
  conversationId: string;
  other?: MessagePerson;
  messages: Message[];
  /** There are older messages than the ones loaded. */
  hasMore: boolean;
  canReply: boolean;
  closedReason?: ClosedReason;
};

export const THREAD_PAGE = 40;

type ProfileRow = { id: string; handle: string | null; display_name: string | null };

const unique = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => !!v))];

const toPerson = (row: ProfileRow): MessagePerson => ({
  id: row.id,
  handle: row.handle ?? undefined,
  displayName: row.display_name ?? undefined,
});

async function fetchPeople(ids: string[]): Promise<Map<string, MessagePerson>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.from('profiles').select('id, handle, display_name').in('id', ids);
  if (error) throw new Error(error.message);
  return new Map((data as ProfileRow[]).map((row) => [row.id, toPerson(row)]));
}

/**
 * The cars named by messages, with a cover photo each. A car that has been
 * unpublished is unreadable now, so it's simply absent from the result.
 */
async function fetchCars(vehicleIds: string[]): Promise<Map<string, MessageCar>> {
  if (vehicleIds.length === 0) return new Map();

  const [vehicles, ownerships] = await Promise.all([
    supabase.from('vehicles').select(VEHICLE_COLUMNS).in('id', vehicleIds),
    supabase.from('ownerships').select('id, vehicle_id').in('vehicle_id', vehicleIds).is('ended_on', null),
  ]);
  if (vehicles.error) throw new Error(vehicles.error.message);
  if (ownerships.error) throw new Error(ownerships.error.message);

  const ownershipRows = ownerships.data as { id: string; vehicle_id: string }[];
  const galleries = await loadGalleries(ownershipRows.map((o) => o.id));
  const ownershipByVehicle = new Map(ownershipRows.map((o) => [o.vehicle_id, o.id]));

  const cars = new Map<string, MessageCar>();
  for (const row of vehicles.data as unknown as (Parameters<typeof toDecodedVehicle>[0] & { id: string })[]) {
    const ownershipId = ownershipByVehicle.get(row.id);
    const photo = ownershipId ? galleries.get(ownershipId)?.[0] : undefined;
    cars.set(row.id, {
      vehicleId: row.id,
      vehicle: toDecodedVehicle(row),
      photoUrl: photo?.url,
      photoThumbUrl: photo?.thumbUrl,
    });
  }
  return cars;
}

type MessageRow = {
  id: string;
  sender_id: string;
  body: string;
  vehicle_id: string | null;
  created_at: string;
};

const MESSAGE_COLUMNS = 'id, sender_id, body, vehicle_id, created_at';

function toMessage(row: MessageRow, me: string, cars: Map<string, MessageCar>): Message {
  return {
    id: row.id,
    senderId: row.sender_id,
    mine: row.sender_id === me,
    body: row.body,
    at: row.created_at,
    hasCar: !!row.vehicle_id,
    car: row.vehicle_id ? cars.get(row.vehicle_id) : undefined,
  };
}

/** The signed-in member's conversations with something in them, newest first. */
export async function loadInbox(): Promise<InboxItem[]> {
  const me = await requireUserId();
  const { data, error } = await supabase.rpc('my_inbox');
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as {
    conversation_id: string;
    other_id: string | null;
    last_body: string;
    last_vehicle_id: string | null;
    last_sender_id: string;
    last_at: string;
    unread: number;
    can_reply: boolean;
  }[];

  const people = await fetchPeople(unique(rows.map((r) => r.other_id)));
  return rows.map((row) => ({
    conversationId: row.conversation_id,
    other: row.other_id ? people.get(row.other_id) : undefined,
    lastBody: row.last_body,
    lastFromMe: row.last_sender_id === me,
    lastHasCar: !!row.last_vehicle_id,
    lastAt: row.last_at,
    unread: row.unread,
    canReply: row.can_reply,
  }));
}

/** Unread messages across every conversation: the number on the badge. */
export async function loadUnreadCount(): Promise<number> {
  const { data, error } = await supabase.rpc('unread_message_count');
  if (error) throw new Error(error.message);
  return (data as number | null) ?? 0;
}

/**
 * Messages for a conversation, oldest first. Pass `before` (the oldest
 * message's time) for the page of earlier ones.
 */
async function loadMessages(conversationId: string, me: string, before?: string) {
  let query = supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(THREAD_PAGE);
  if (before) query = query.lt('created_at', before);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data as MessageRow[]).slice().reverse();
  const cars = await fetchCars(unique(rows.map((r) => r.vehicle_id)));
  return {
    messages: rows.map((row) => toMessage(row, me, cars)),
    hasMore: rows.length === THREAD_PAGE,
  };
}

/** The newest messages of a conversation, to merge into what's on screen. */
export async function loadLatestMessages(conversationId: string): Promise<Message[]> {
  const me = await requireUserId();
  return (await loadMessages(conversationId, me)).messages;
}

export async function loadEarlierMessages(
  conversationId: string,
  before: string
): Promise<{ messages: Message[]; hasMore: boolean }> {
  const me = await requireUserId();
  return loadMessages(conversationId, me, before);
}

/** A conversation and its latest messages, or null if it isn't the member's to read. */
export async function loadThread(conversationId: string): Promise<Thread | null> {
  const me = await requireUserId();
  const { data: conversation, error } = await supabase
    .from('conversations')
    .select('id, member_low, member_high')
    .eq('id', conversationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!conversation) return null;

  const otherId = conversation.member_low === me ? conversation.member_high : conversation.member_low;

  const [people, page, canReply, paused] = await Promise.all([
    otherId ? fetchPeople([otherId]) : new Map<string, MessagePerson>(),
    loadMessages(conversationId, me),
    otherId ? supabase.rpc('can_message', { other: otherId }) : null,
    supabase.rpc('messaging_paused'),
  ]);
  if (canReply?.error) throw new Error(canReply.error.message);

  const open = canReply?.data === true;
  return {
    conversationId,
    other: otherId ? people.get(otherId) : undefined,
    messages: page.messages,
    hasMore: page.hasMore,
    canReply: open,
    closedReason: open ? undefined : !otherId ? 'left' : paused.data === true ? 'paused' : 'ended',
  };
}

/** Say the database's refusals in words, not Postgres's. */
function refusal(error: { code?: string; message: string }): Error {
  if (error.code === '42501') {
    return new Error("You can't message this member right now. You both need to follow each other.");
  }
  return new Error(error.message);
}

/** Send a message, optionally with a car attached. Returns it as stored. */
export async function sendMessage(
  conversationId: string,
  body: string,
  car?: MessageCar
): Promise<Message> {
  const text = body.trim();
  if (!text) throw new Error('Write something first.');
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Messages can be up to ${MAX_MESSAGE_LENGTH} characters.`);
  }

  const me = await requireUserId();
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: me,
      body: text,
      vehicle_id: car?.vehicleId ?? null,
    })
    .select(MESSAGE_COLUMNS)
    .single();

  if (error) throw refusal(error);
  const row = data as MessageRow;
  return toMessage(row, me, new Map(car ? [[car.vehicleId, car]] : []));
}

/** Open the conversation with a member, starting it if the two may talk. */
export async function startConversation(otherId: string): Promise<string> {
  const { data, error } = await supabase.rpc('start_conversation', { other: otherId });
  if (error) throw refusal(error);
  return data as string;
}

/** Things that change the unread count tell the badge, so it needn't wait for its next poll. */
const unreadListeners = new Set<() => void>();

export function onUnreadChange(listener: () => void): () => void {
  unreadListeners.add(listener);
  return () => {
    unreadListeners.delete(listener);
  };
}

function unreadChanged() {
  unreadListeners.forEach((listener) => listener());
}

export async function markRead(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_conversation_read', { conversation: conversationId });
  if (error) throw new Error(error.message);
  unreadChanged();
}

/** Delete a conversation for the member only; the other side keeps theirs. */
export async function clearConversation(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('clear_conversation', { conversation: conversationId });
  if (error) throw new Error(error.message);
  unreadChanged();
}

export type MessageAccess = {
  /** The signed-in member may message them now. */
  canMessage: boolean;
  iFollow: boolean;
  followsMe: boolean;
};

/** What the signed-in member can do about messaging one person, for their page. */
export async function loadMessageAccess(profileId: string): Promise<MessageAccess> {
  const me = await requireUserId();
  const [allowed, follows] = await Promise.all([
    supabase.rpc('can_message', { other: profileId }),
    supabase
      .from('member_follows')
      .select('follower_id, followed_id')
      .or(
        `and(follower_id.eq.${me},followed_id.eq.${profileId}),and(follower_id.eq.${profileId},followed_id.eq.${me})`
      ),
  ]);
  if (allowed.error) throw new Error(allowed.error.message);
  if (follows.error) throw new Error(follows.error.message);

  const rows = follows.data as { follower_id: string; followed_id: string }[];
  return {
    canMessage: allowed.data === true,
    iFollow: rows.some((r) => r.follower_id === me),
    followsMe: rows.some((r) => r.follower_id === profileId),
  };
}

/** Members who follow the signed-in member and are followed back: who they can message. */
export async function loadMutuals(): Promise<MessagePerson[]> {
  const me = await requireUserId();
  const [mine, theirs] = await Promise.all([
    supabase.from('member_follows').select('followed_id').eq('follower_id', me),
    supabase.from('member_follows').select('follower_id').eq('followed_id', me),
  ]);
  if (mine.error) throw new Error(mine.error.message);
  if (theirs.error) throw new Error(theirs.error.message);

  const iFollow = new Set((mine.data as { followed_id: string }[]).map((r) => r.followed_id));
  const mutual = (theirs.data as { follower_id: string }[])
    .map((r) => r.follower_id)
    .filter((id) => iFollow.has(id));

  const people = [...(await fetchPeople(mutual)).values()].filter((p) => p.handle);
  return people.sort((a, b) =>
    (a.displayName ?? a.handle ?? '').localeCompare(b.displayName ?? b.handle ?? '')
  );
}

export type ShareableCar = { vehicleId: string; vehicle: DecodedVehicle; mine: boolean };

type VehicleWithId = Parameters<typeof toDecodedVehicle>[0] & { id: string };

/**
 * Cars worth attaching to a message: the member's own published cars, then
 * cars they follow. Only published cars can be attached (the database checks
 * too), so a car that has gone private since is already filtered out here.
 */
export async function loadShareableCars(): Promise<ShareableCar[]> {
  const me = await requireUserId();
  const [own, followed] = await Promise.all([
    supabase
      .from('ownerships')
      .select(`vehicles!inner (${VEHICLE_COLUMNS})`)
      .eq('owner_id', me)
      .eq('is_public', true)
      .is('ended_on', null),
    supabase
      .from('car_follows')
      .select(`vehicles!inner (${VEHICLE_COLUMNS})`)
      .eq('follower_id', me)
      .order('created_at', { ascending: false }),
  ]);
  if (own.error) throw new Error(own.error.message);
  if (followed.error) throw new Error(followed.error.message);

  const seen = new Set<string>();
  const cars: ShareableCar[] = [];
  const add = (rows: { vehicles: VehicleWithId }[], mine: boolean) => {
    for (const { vehicles } of rows) {
      if (seen.has(vehicles.id)) continue;
      seen.add(vehicles.id);
      cars.push({ vehicleId: vehicles.id, vehicle: toDecodedVehicle(vehicles), mine });
    }
  };
  add(own.data as unknown as { vehicles: VehicleWithId }[], true);
  add(followed.data as unknown as { vehicles: VehicleWithId }[], false);
  return cars;
}

/** The car as a card, for a car picked from the list. */
export async function loadCarCard(car: ShareableCar): Promise<MessageCar> {
  const cards = await fetchCars([car.vehicleId]);
  return cards.get(car.vehicleId) ?? { vehicleId: car.vehicleId, vehicle: car.vehicle };
}

/** Whether the signed-in member gets an email about messages they haven't read (0014). */
export async function loadMessageEmails(): Promise<boolean> {
  const me = await requireUserId();
  const { data, error } = await supabase
    .from('message_email_settings')
    .select('enabled')
    .eq('profile_id', me)
    .maybeSingle();
  if (error) throw new Error(error.message);
  // No row can't happen for a real account (every profile gets one), but if it
  // did, the default is on.
  return data?.enabled ?? true;
}

export async function setMessageEmails(enabled: boolean): Promise<void> {
  const me = await requireUserId();
  const { error } = await supabase.from('message_email_settings').update({ enabled }).eq('profile_id', me);
  if (error) throw new Error(error.message);
}
