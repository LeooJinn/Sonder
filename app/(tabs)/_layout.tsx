import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { focusRing, type PressState } from '../../components/ui';
import { TabIcon, type IconName } from '../../components/TabIcon';
import { useUnreadMessages } from '../../components/useUnreadMessages';
import { hasNewInFeed } from '../../lib/feed';
import { useAuth } from '../../lib/auth';
import { duration, ease, nativeDriver, useReducedMotion } from '../../lib/motion';
import { colors, fonts } from '../../lib/theme';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICON_FOR: Record<string, IconName> = {
  index: 'garage',
  following: 'following',
  market: 'market',
  meets: 'meets',
  messages: 'messages',
};

/**
 * The places a member spends time: their own cars, the cars and people they
 * follow, cars for sale, meets, and messages. Each has a drawn icon that
 * plays a small motion when you arrive, under a foil rule that slides to
 * wherever you are.
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Garage' }} />
      <Tabs.Screen name="following" options={{ title: 'Following' }} />
      <Tabs.Screen name="market" options={{ title: 'For sale' }} />
      <Tabs.Screen name="meets" options={{ title: 'Meets' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
    </Tabs>
  );
}

function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const reduced = useReducedMotion();
  const unread = useUnreadMessages();
  const current = state.routes[state.index]?.name;
  const [fresh, setFresh] = useState(false);
  const [width, setWidth] = useState(0);

  // Checked whenever the member changes tab, which is often enough for a
  // feed of car work: nothing about it is urgent. The Following screen marks
  // the feed seen when it opens, so the dot clears on the way out.
  useEffect(() => {
    if (!session || current === 'following') return;
    let live = true;
    hasNewInFeed()
      .then((next) => live && setFresh(next))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [session, current]);

  // The foil rule: one shape that travels, rather than a mark that vanishes
  // from one tab and appears on the next, so the eye follows where you went.
  const count = state.routes.length;
  const slot = width / count;
  const rule = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  useEffect(() => {
    if (!width) return;
    const x = state.index * slot + (slot - RULE_WIDTH) / 2;
    if (!placed.current || reduced) {
      rule.setValue(x);
      placed.current = true;
      return;
    }
    Animated.timing(rule, { toValue: x, duration: duration.slow, easing: ease.out, useNativeDriver: nativeDriver }).start();
  }, [state.index, slot, width, reduced, rule]);

  return (
    <View
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}
      accessibilityRole="tablist"
    >
      <View style={styles.inner} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? <Animated.View pointerEvents="none" style={[styles.rule, { transform: [{ translateX: rule }] }]} /> : null}
        {state.routes.map((route, index) => {
          const selected = state.index === index;
          const label = descriptors[route.key].options.title ?? route.name;
          const badge = route.name === 'messages' && unread > 0 ? unread : 0;
          const dot = route.name === 'following' && fresh && !selected;
          const hint = badge > 0 ? `, ${badge} unread` : dot ? ', new' : '';

          return (
            <TabButton
              key={route.key}
              label={label}
              selected={selected}
              icon={ICON_FOR[route.name] ?? 'garage'}
              badge={badge}
              dot={dot}
              accessibilityLabel={`${label}${hint}`}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!selected && !event.defaultPrevented) navigation.navigate(route.name);
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

const RULE_WIDTH = 28;

function TabButton({
  label,
  selected,
  icon,
  badge,
  dot,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  selected: boolean;
  icon: IconName;
  badge: number;
  dot: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const press = useRef(new Animated.Value(1)).current;
  const squeeze = (to: number) => {
    if (reduced) return;
    Animated.timing(press, { toValue: to, duration: to < 1 ? 90 : duration.base, easing: ease.out, useNativeDriver: nativeDriver }).start();
  };

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onPressIn={() => squeeze(0.9)}
      onPressOut={() => squeeze(1)}
      style={(state) => [styles.tab, (state as PressState).focused && focusRing]}
    >
      <Animated.View style={[styles.stack, { transform: [{ scale: press }] }]}>
        <View>
          <TabIcon
            name={icon}
            active={selected}
            color={selected ? colors.accent : colors.textFaint}
            accent={selected ? colors.accent : colors.textFaint}
          />
          {badge > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
            </View>
          ) : null}
          {dot ? <View style={styles.dot} /> : null}
        </View>
        <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inner: { flexDirection: 'row', width: '100%', maxWidth: 640, alignSelf: 'center' },
  // A short foil rule along the top edge, like the tab on a file divider.
  rule: { position: 'absolute', top: -1, left: 0, width: RULE_WIDTH, height: 2, backgroundColor: colors.accent },
  tab: { flex: 1, alignItems: 'center', minHeight: 56, paddingTop: 9, paddingBottom: 3 },
  stack: { alignItems: 'center', gap: 3 },
  label: { fontFamily: fonts.display, fontSize: 14, lineHeight: 17, color: colors.textFaint },
  labelSelected: { color: colors.text },
  // Unread messages, as a count. New in the feed, as a dot: it's news, not a to-do.
  badge: {
    position: 'absolute',
    top: -5,
    left: 15,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.bodySemi, fontSize: 11, lineHeight: 14, color: colors.onAccent },
  dot: {
    position: 'absolute',
    top: -1,
    right: -3,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
});
