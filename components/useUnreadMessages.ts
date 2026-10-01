import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { loadUnreadCount, onUnreadChange } from '../lib/messages';

/** How often the badge asks again. Reading or deleting a conversation tells it sooner. */
const POLL_MS = 30_000;

/**
 * How many messages the member hasn't read, for the badge on the Messages
 * tab. Zero until it's known, and zero if it can't be fetched: the badge is a
 * courtesy, not something to show an error for.
 */
export function useUnreadMessages(): number {
  const { session } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!session) {
      setCount(0);
      return;
    }
    let live = true;
    const refresh = () => {
      loadUnreadCount()
        .then((next) => live && setCount(next))
        .catch(() => {});
    };
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    const stopListening = onUnreadChange(refresh);
    return () => {
      live = false;
      clearInterval(timer);
      stopListening();
    };
  }, [session]);

  return count;
}
