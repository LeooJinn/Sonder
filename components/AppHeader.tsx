import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, column, fonts } from '../lib/theme';
import { focusRing, type PressState } from './ui';

/**
 * The header on every stacked screen, in place of the navigator's own.
 *
 * The stock header spans the whole window, so on a desktop browser the title
 * sits at the far left while the page's content is a centred column. This
 * one shares the column. It also knows what to do when there's no history —
 * someone who opened /vehicle/... from a bookmark gets a way to the garage
 * rather than a missing back button.
 */
export function AppHeader({
  title,
  canGoBack,
  onBack,
}: {
  title?: string;
  canGoBack: boolean;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <View style={styles.inner}>
        <Pressable
          onPress={canGoBack ? onBack : () => router.replace('/')}
          accessibilityRole="button"
          accessibilityLabel={canGoBack ? 'Back' : 'Go to your garage'}
          style={(state) => {
            const { pressed, focused } = state as PressState;
            return [styles.back, pressed && styles.pressed, focused && focusRing];
          }}
        >
          <View style={styles.chevron} />
          {!canGoBack ? <Text style={styles.backLabel}>Garage</Text> : null}
        </Pressable>
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.background },
  inner: {
    ...column,
    maxWidth: column.maxWidth + 8,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 8,
    gap: 4,
  },
  back: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 22,
  },
  pressed: { backgroundColor: colors.surface },
  chevron: {
    width: 11,
    height: 11,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.text,
    transform: [{ rotate: '45deg' }],
    marginLeft: 4,
  },
  backLabel: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.text, flexShrink: 1 },
});
