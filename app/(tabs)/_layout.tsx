import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { focusRing, type PressState } from '../../components/ui';
import { hasNewInFeed } from '../../lib/feed';
import { useAuth } from '../../lib/auth';
import { colors, fonts, type } from '../../lib/theme';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/**
 * The places a member spends time: their own cars, the cars and people they
 * follow, cars for sale, and meets. Words rather than icons — "Meets" needs no decoding, and an icon set
 * would be the one borrowed thing in an app that otherwise looks like itself.
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
    </Tabs>
  );
}

function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const current = state.routes[state.index]?.name;
  const [fresh, setFresh] = useState(false);

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

  return (
    <View
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}
      accessibilityRole="tablist"
    >
      <View style={styles.inner}>
        {state.routes.map((route, index) => {
          const selected = state.index === index;
          const label = descriptors[route.key].options.title ?? route.name;
          const dot = route.name === 'following' && fresh && !selected;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={dot ? `${label}, new` : label}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!selected && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={(pressState) => [
                styles.tab,
                (pressState as PressState).focused && focusRing,
              ]}
            >
              <View style={[styles.marker, selected && styles.markerSelected]} />
              <View style={styles.labelRow}>
                <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
                {dot ? <View style={styles.dot} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inner: { flexDirection: 'row', width: '100%', maxWidth: 640, alignSelf: 'center' },
  tab: { flex: 1, alignItems: 'center', paddingTop: 0, paddingBottom: 4, minHeight: 48 },
  // A short foil rule along the top edge, like the tab on a file divider.
  marker: { width: 28, height: 2, marginBottom: 10, backgroundColor: 'transparent' },
  markerSelected: { backgroundColor: colors.accent },
  labelRow: { flexDirection: 'row', alignItems: 'flex-start' },
  // New since the last look: a small red mark, in the red tuned for the
  // cover, set like a superscript so the word doesn't move when it clears.
  dot: {
    position: 'absolute',
    right: -9,
    top: 3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.danger,
  },
  label: { fontFamily: fonts.display, fontSize: type.item.fontSize, color: colors.textFaint },
  labelSelected: { color: colors.text },
});
