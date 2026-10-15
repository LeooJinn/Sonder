import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors, object, type } from '../lib/theme';
import { PassportBook } from './PassportBook';
import { PassportCover } from './PassportCover';
import { WIDE_BREAKPOINT } from './useWide';

/**
 * The frame for the pages a message lands on (reset a password, confirm an
 * email, sign in by link): the same layout as sign-in. On a wide screen the
 * passport stands on its desk beside the form; on a phone the cover sits above it.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.split}>
        {wide ? (
          <View style={styles.showcase} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={styles.spotlight} />
            <View style={styles.book}>
              <PassportBook />
            </View>
            <Text style={styles.line}>A logbook that stays with the car.</Text>
          </View>
        ) : null}
        <ScrollView
          style={wide ? styles.formPane : undefined}
          contentContainerStyle={[styles.content, wide && styles.contentWide]}
          keyboardShouldPersistTaps="handled"
        >
          {wide ? null : <PassportCover />}
          {children}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  split: { flex: 1, flexDirection: 'row' },
  showcase: { flex: 1.1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  spotlight: {
    position: 'absolute',
    width: '90%',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: object.coverMid,
    opacity: 0.45,
  },
  book: { width: '100%', height: '72%' },
  line: { ...type.display, color: colors.text, textAlign: 'center', marginTop: 8, paddingHorizontal: 40 },
  formPane: { flex: 1, maxWidth: 600, backgroundColor: colors.surface },
  content: { padding: 24, paddingTop: 72, paddingBottom: 48, maxWidth: 440, width: '100%', alignSelf: 'center' },
  contentWide: { paddingTop: 120 },
});
