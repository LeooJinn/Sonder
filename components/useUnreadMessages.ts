import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../lib/auth';
import { loadUnreadCount } from '../lib/messages';

/**
 * How many messages the member hasn't read, refreshed each time the screen
 * comes into view. Zero until it's known, and zero if it can't be fetched:
 * the badge is a courtesy, not something to show an error for.
 */
export function useUnreadMessages(): number {
  const { session } = useAuth();
  const [count, setCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let live = true;
      loadUnreadCount()
        .then((next) => live && setCount(next))
        .catch(() => {});
      return () => {
        live = false;
      };
    }, [session])
  );

  return count;
}
