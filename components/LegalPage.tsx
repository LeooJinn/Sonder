import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent, type ViewStyle } from 'react-native';
import { Link, Stack } from 'expo-router';
import { CONTACT_EMAIL, LEGAL_UPDATED, type LegalDocument } from '../lib/legal';
import { focusRing, type PressState } from './ui';
import { colors, column, fonts, type } from '../lib/theme';
import { WIDE_BREAKPOINT } from './useWide';

/**
 * A long document in the app's own type: the Privacy Policy and the Terms.
 * Both read from lib/legal.ts so they share one layout.
 */
export function LegalPage({ doc }: { doc: LegalDocument }) {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const scroll = useRef<ScrollView>(null);
  const splitY = useRef(0);
  const tops = useRef<Record<string, number>>({});
  const [active, setActive] = useState(doc.sections[0]?.heading ?? '');

  // Every heading the page has, in order, for the contents and for the end.
  const headings = [
    ...doc.sections.map((section) => section.heading),
    CONTACT_EMAIL ? 'Contact' : 'Getting in touch',
  ];

  function jump(heading: string) {
    const y = tops.current[heading];
    if (y !== undefined) scroll.current?.scrollTo({ y: splitY.current + y - 24, animated: true });
  }

  // The contents follow the reader: the last heading that has reached the top.
  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = event.nativeEvent.contentOffset.y - splitY.current + 180;
    let current = headings[0];
    for (const heading of headings) {
      if ((tops.current[heading] ?? Infinity) <= y) current = heading;
    }
    if (current !== active) setActive(current);
  }

  const mark = (heading: string) => (e: { nativeEvent: { layout: { y: number } } }) => {
    tops.current[heading] = e.nativeEvent.layout.y;
  };

  const body = (
    <View style={wide ? styles.bodyWide : undefined}>
      {doc.sections.map((section) => (
        <View key={section.heading} style={styles.section} onLayout={mark(section.heading)}>
          <Text style={styles.heading} accessibilityRole="header">
            {section.heading}
          </Text>
          {section.paragraphs.map((paragraph) => (
            <Text key={paragraph} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
          {section.bullets?.map((bullet) => (
            <View key={bullet} style={styles.bulletRow}>
              <Text style={styles.bulletMark}>{'•'}</Text>
              <Text style={styles.bulletText}>{bullet}</Text>
            </View>
          ))}
        </View>
      ))}

      {CONTACT_EMAIL ? (
        <View style={styles.section} onLayout={mark('Contact')}>
          <Text style={styles.heading} accessibilityRole="header">
            Contact
          </Text>
          <Text style={styles.paragraph}>
            Questions, or a request about your data or these terms: {CONTACT_EMAIL}
          </Text>
        </View>
      ) : (
        <View style={styles.section} onLayout={mark('Getting in touch')}>
          <Text style={styles.heading} accessibilityRole="header">
            Getting in touch
          </Text>
          <Text style={styles.paragraph}>
            Sonder is a small project and does not have a public contact address yet. Almost
            everything described here you can do yourself in the app: publish or unpublish a
            car, switch emails off, block or report, change your email or password, and delete
            your account. When a contact address exists, it will be listed here.
          </Text>
        </View>
      )}

      <Text style={styles.other}>
        {doc.title === 'Privacy Policy' ? (
          <Link href="/terms" style={styles.link}>
            Terms of Use
          </Link>
        ) : (
          <Link href="/privacy" style={styles.link}>
            Privacy Policy
          </Link>
        )}
      </Text>
    </View>
  );

  return (
    <ScrollView
      ref={scroll}
      style={styles.screen}
      contentContainerStyle={[styles.content, wide && styles.contentWide]}
      onScroll={onScroll}
      scrollEventThrottle={32}
    >
      <Stack.Screen options={{ title: doc.title }} />
      <Text style={[styles.title, wide && styles.titleWide]} accessibilityRole="header">
        {doc.title}
      </Text>
      <Text style={styles.updated}>Last updated {LEGAL_UPDATED}</Text>
      <Text style={[styles.intro, wide && styles.introWide]}>{doc.intro}</Text>

      {wide ? (
        <View style={styles.split} onLayout={(e) => (splitY.current = e.nativeEvent.layout.y)}>
          {/* Contents: a long document is easier to trust when you can see its shape. */}
          <View style={styles.toc} accessibilityRole="menu">
            <Text style={styles.tocTitle}>In this page</Text>
            {headings.map((heading, i) => {
              const on = heading === active;
              return (
                <Pressable
                  key={heading}
                  onPress={() => jump(heading)}
                  accessibilityRole="link"
                  style={(state) => [styles.tocItem, on && styles.tocItemOn, (state as PressState).focused && focusRing]}
                >
                  <Text style={[styles.tocNumber, on && styles.tocTextOn]}>{String(i + 1).padStart(2, '0')}</Text>
                  <Text style={[styles.tocText, on && styles.tocTextOn]} numberOfLines={2}>
                    {heading}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {body}
        </View>
      ) : (
        body
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 64, ...column },
  contentWide: { maxWidth: 1080, paddingHorizontal: 40, paddingTop: 40 },
  title: { ...type.display, color: colors.text },
  titleWide: { ...type.poster, fontSize: 88, lineHeight: 82 },
  introWide: { maxWidth: 680, fontSize: 20, lineHeight: 30 },
  split: { flexDirection: 'row', gap: 64, alignItems: 'flex-start', marginTop: 24 },
  bodyWide: { flex: 1, maxWidth: 680, minWidth: 0 },
  toc: { width: 248, position: 'sticky' as ViewStyle['position'], top: 24, paddingTop: 32 },
  tocTitle: { ...type.label, color: colors.textFaint, marginBottom: 10 },
  tocItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginLeft: -10,
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
  },
  // Where you are in the document: the same foil rule as everywhere else.
  tocItemOn: { borderLeftColor: colors.accent },
  tocNumber: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20, color: colors.textFaint, fontVariant: ['tabular-nums'] },
  tocText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 20, color: colors.textMuted },
  tocTextOn: { color: colors.text },
  updated: { ...type.small, color: colors.textFaint, marginTop: 6 },
  intro: { ...type.lead, color: colors.textMuted, marginTop: 20 },
  section: { marginTop: 32, gap: 10 },
  heading: { ...type.heading, color: colors.text },
  paragraph: { ...type.body, color: colors.textMuted },
  bulletRow: { flexDirection: 'row', gap: 10, paddingRight: 8 },
  bulletMark: { ...type.body, color: colors.accent },
  bulletText: { ...type.body, color: colors.textMuted, flex: 1 },
  other: { marginTop: 40 },
  link: { fontFamily: fonts.bodySemi, fontSize: type.compact.fontSize, color: colors.accent },
});
