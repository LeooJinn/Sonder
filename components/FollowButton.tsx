import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import {
  followCar,
  followMember,
  loadCarFollow,
  loadMemberFollow,
  unfollowCar,
  unfollowMember,
  type FollowState,
} from '../lib/follows';
import { colors, type } from '../lib/theme';
import { Button } from './ui';

export function followerCount(count: number): string {
  return `${count} ${count === 1 ? 'follower' : 'followers'}`;
}

/**
 * Follow a car or a person. An outline, never foil: following is a
 * reasonable thing to do on a passport, not the one way on.
 *
 * Visitors get "Sign in to follow", which is the whole pitch for an account
 * in two words. `compact` drops the count and shrinks the outline, for rows
 * in a list; once followed it settles to plain text so the list quietens as
 * you go.
 */
export function FollowButton({
  kind,
  id,
  name,
  compact,
  initial,
  onChange,
}: {
  kind: 'car' | 'member';
  id: string;
  /** For screen readers: "Follow Sam", "Follow the 2019 Civic". */
  name: string;
  compact?: boolean;
  /** Skip the lookup when the caller already knows, as the feed does. */
  initial?: FollowState;
  onChange?: (state: FollowState) => void;
}) {
  const { session } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<FollowState | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) return;
    let live = true;
    (kind === 'car' ? loadCarFollow(id) : loadMemberFollow(id))
      .then((next) => live && setState(next))
      .catch(() => live && setState({ following: false, count: 0 }));
    return () => {
      live = false;
    };
    // The session is a dependency: signing in changes "following".
  }, [kind, id, initial, session]);

  if (!session) {
    return (
      <View style={compact ? undefined : styles.row}>
        <Button
          label="Sign in to follow"
          variant={compact ? 'subtle' : 'secondary'}
          onPress={() => router.push('/sign-in')}
        />
        {!compact && state && state.count > 0 ? (
          <Text style={styles.count}>{followerCount(state.count)}</Text>
        ) : null}
      </View>
    );
  }

  async function toggle() {
    if (!state) return;
    const next = {
      following: !state.following,
      count: Math.max(0, state.count + (state.following ? -1 : 1)),
    };
    // Optimistic, like the public-link switch: flip now, put it back on failure.
    setState(next);
    setError(null);
    onChange?.(next);
    try {
      if (kind === 'car') await (next.following ? followCar(id) : unfollowCar(id));
      else await (next.following ? followMember(id) : unfollowMember(id));
    } catch (e) {
      setState(state);
      onChange?.(state);
      setError(e instanceof Error ? e.message : 'That did not work. Try again.');
    }
  }

  const following = state?.following ?? false;

  return (
    <View>
      <View style={compact ? undefined : styles.row}>
        <Button
          label={following ? 'Following' : 'Follow'}
          variant={compact && following ? 'subtle' : 'secondary'}
          busy={!state && !compact}
          disabled={!state}
          onPress={toggle}
          accessibilityHint={following ? `Stops following ${name}` : `Follows ${name}`}
          style={compact ? (following ? undefined : styles.compact) : styles.button}
        />
        {!compact && state && state.count > 0 ? (
          <Text style={styles.count}>{followerCount(state.count)}</Text>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  button: { minWidth: 124 },
  compact: { minHeight: 44, paddingHorizontal: 16 },
  count: { ...type.small, color: colors.textMuted },
  error: { ...type.caption, color: colors.danger, marginTop: 8 },
});
