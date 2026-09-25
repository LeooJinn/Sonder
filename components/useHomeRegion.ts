import { useEffect, useState } from 'react';
import { loadMyProfile } from '../lib/profile';

/**
 * A region filter that starts on the member's own region, since cars for
 * sale and meets nearby are what most people want first. Empty string means
 * everywhere. `ready` stays false until the profile has been read, so a
 * screen doesn't load everywhere and then immediately reload for one region.
 */
export function useHomeRegion(): [string, (region: string) => void, boolean] {
  const [region, setRegion] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadMyProfile()
      .then((profile) => setRegion(profile.region ?? ''))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  return [region, setRegion, ready];
}
