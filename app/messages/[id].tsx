import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThreadView } from '../../components/ThreadView';
import { useTwoPane } from '../../components/useWide';

/**
 * One conversation. Route: /messages/:id
 *
 * On a phone it is a screen of its own. Where there is room for two panes (see useTwoPane) conversations live
 * beside the inbox (see the Messages tab), so this route hands over to it.
 */
export default function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const wide = useTwoPane();

  useEffect(() => {
    if (wide && id) router.replace({ pathname: '/messages', params: { c: id } });
  }, [wide, id, router]);

  if (wide) return null;
  return <ThreadView id={id} onLeave={() => router.replace('/messages')} />;
}
