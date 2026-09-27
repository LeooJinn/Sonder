import { useState } from 'react';
import { Image, type ImageProps } from 'react-native';

/**
 * A photo shown from its thumbnail, falling back to the original.
 *
 * Thumbnails are made at upload (see uploadImage in lib/photos). Photos from
 * before that have none, and a missing thumbnail 404s; this swaps to the
 * full-size file on the first error instead of showing a blank.
 */
export function PhotoImage({
  thumbUrl,
  url,
  ...image
}: Omit<ImageProps, 'source'> & { thumbUrl?: string; url: string }) {
  const [failed, setFailed] = useState(false);
  const uri = !failed && thumbUrl ? thumbUrl : url;

  return <Image {...image} source={{ uri }} onError={() => setFailed(true)} />;
}
