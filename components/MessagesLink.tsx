import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useUnreadMessages } from './useUnreadMessages';
import { colors, fonts, type } from '../lib/theme';
import { focusRing, type PressState } from './ui';

/**
 * The way into messages, from the garage's top bar. A quiet link like
 * Profile beside it; unread messages add the small red mark the Following
 * tab uses, set like a superscript so the word doesn't move when it clears.
 */
export function MessagesLink() {
  const router = useRouter();
  const unread = useUnreadMessages();

  return (
    <Pressable
      onPress={() => router.push('/messages')}
      accessibilityRole="link"
      accessibilityLabel={unread > 0 ? `Messages, ${unread} unread` : 'Messages'}
      style={(state) => {
        const { pressed, focused } = state as PressState;
        return [styles.link, pressed && styles.pressed, focused && focusRing];
      }}
    >
      <View>
        <Text style={styles.label}>Messages</Text>
        {unread > 0 ? <View style={styles.dot} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The same 44pt hit area as the app's other quiet links, laid out like text.
  link: { minHeight: 44, paddingHorizontal: 8, marginHorizontal: -8, marginVertical: -12, justifyContent: 'center' },
  pressed: { opacity: 0.75 },
  label: { fontFamily: fonts.bodySemi, fontSize: type.compact.fontSize, color: colors.accent },
  dot: {
    position: 'absolute',
    right: -9,
    top: 0,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.danger,
  },
});
