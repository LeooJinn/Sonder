import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { focusRing, type PressState } from '../../components/ui';
import { colors, fonts } from '../../lib/theme';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/**
 * The three places a member spends time: their own cars, cars for sale, and
 * meets. Words rather than icons — "Meets" needs no decoding, and an icon set
 * would be the one borrowed thing in an app that otherwise looks like itself.
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Garage' }} />
      <Tabs.Screen name="market" options={{ title: 'For sale' }} />
      <Tabs.Screen name="meets" options={{ title: 'Meets' }} />
    </Tabs>
  );
}

function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}
      accessibilityRole="tablist"
    >
      <View style={styles.inner}>
        {state.routes.map((route, index) => {
          const selected = state.index === index;
          const label = descriptors[route.key].options.title ?? route.name;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
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
              <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
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
  label: { fontFamily: fonts.display, fontSize: 18, color: colors.textFaint },
  labelSelected: { color: colors.text },
});
