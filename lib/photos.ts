/**
 * Photos on build log entries.
 *
 * Every photo exists in two places that Postgres does not connect for you:
 * a row in public.photos, and an object in the "photos" storage bucket.
 * Deleting the row cascades when its entry goes; deleting the file does not.
 * Anything here that removes a row removes the object first, or the bucket
 * silently accumulates files nothing points at.
 *
 * Storage paths are always "<user_id>/<entry_id>/<uuid>.jpg". The leading
 * folder is what the storage policies check, so a user can only ever write
 * inside their own.
 */

import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { supabase } from './supabase';

const BUCKET = 'photos';

/** Long edge, in pixels, that uploads are resized down to before sending. */
const MAX_DIMENSION = 1600;

/** JPEG quality. 0.8 is roughly indistinguishable at a fraction of the size. */
const QUALITY = 0.8;

export type Photo = {
  id: string;
  /** Public URL, ready to hand to an <Image>. */
  url: string;
  storagePath: string;
  width?: number;
  height?: number;
};

type PhotoRow = {
  id: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  position: number;
};

/** The public URL for a stored object. Exported so the log can build its own. */
export function publicUrl(storagePath: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

function toPhoto(row: PhotoRow): Photo {
  return {
    id: row.id,
    url: publicUrl(row.storage_path),
    storagePath: row.storage_path,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
  };
}

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('You need to be signed in.');
  return data.user.id;
}

/**
 * Open the photo library and let the user choose images.
 * Returns their local URIs, or an empty array if they cancelled.
 */
export async function pickImages(limit = 6): Promise<string[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Sonder needs permission to access your photos.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: limit,
    // No exif: it carries GPS coordinates, and a public bucket is the last
    // place a photo of someone's car should be advertising where it parks.
    exif: false,
  });

  if (result.canceled) return [];
  return result.assets.map((asset) => asset.uri);
}

/**
 * Shrink and re-encode before upload. A phone photo is several megabytes;
 * this brings it to a couple of hundred kilobytes with no visible loss, which
 * matters for storage cost and for anyone loading a build log on cellular.
 */
async function compress(uri: string): Promise<{ uri: string; width: number; height: number }> {
  const context = ImageManipulator.manipulate(uri);
  // Width only, so the aspect ratio is preserved.
  context.resize({ width: MAX_DIMENSION });

  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: QUALITY });

  return { uri: saved.uri, width: rendered.width, height: rendered.height };
}

/**
 * Read a local image into bytes.
 *
 * The two platforms hand back different kinds of URI. Native gives a
 * `file://` path, which expo-file-system reads directly. Web gives a `blob:`
 * URL that only fetch can resolve — expo-file-system has no filesystem there.
 */
async function readBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    return response.arrayBuffer();
  }
  return new File(uri).arrayBuffer();
}

/** Upload one local image and attach it to an entry. */
export async function addPhoto(entryId: string, localUri: string, position = 0): Promise<Photo> {
  const userId = await requireUserId();
  const { uri, width, height } = await compress(localUri);

  const storagePath = `${userId}/${entryId}/${Crypto.randomUUID()}.jpg`;
  const bytes = await readBytes(uri);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: 'image/jpeg' });

  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from('photos')
    .insert({ entry_id: entryId, storage_path: storagePath, width, height, position })
    .select('id, storage_path, width, height, position')
    .single();

  if (error) {
    // The row failed but the file uploaded. Remove it rather than leaving an
    // object nothing references.
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error(error.message);
  }

  return toPhoto(data as PhotoRow);
}

/** Every photo on an entry, in the order they were added. */
export async function loadPhotos(entryId: string): Promise<Photo[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('id, storage_path, width, height, position')
    .eq('entry_id', entryId)
    .order('position', { ascending: true });

  if (error) throw new Error(error.message);
  return (data as PhotoRow[]).map(toPhoto);
}

/** Remove one photo: the file first, then the row. */
export async function removePhoto(photo: Photo): Promise<void> {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([photo.storagePath]);
  if (storageError) throw new Error(storageError.message);

  const { error } = await supabase.from('photos').delete().eq('id', photo.id);
  if (error) throw new Error(error.message);
}

/**
 * Remove every photo on an entry.
 *
 * Must be called before deleting the entry itself: the rows would cascade,
 * but the files in storage would be left behind with nothing pointing at
 * them and no way to find them again.
 */
export async function removePhotosForEntry(entryId: string): Promise<void> {
  const photos = await loadPhotos(entryId);
  if (photos.length === 0) return;

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove(photos.map((photo) => photo.storagePath));
  if (storageError) throw new Error(storageError.message);

  const { error } = await supabase.from('photos').delete().eq('entry_id', entryId);
  if (error) throw new Error(error.message);
}
