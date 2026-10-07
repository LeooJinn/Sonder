import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { CONTACT_EMAIL, LEGAL_UPDATED, type LegalDocument } from '../lib/legal';
import { colors, column, fonts, type } from '../lib/theme';

/**
 * A long document in the app's own type: the Privacy Policy and the Terms.
 * Both read from lib/legal.ts so they share one layout.
 */
export function LegalPage({ doc }: { doc: LegalDocument }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: doc.title }} />
      <Text style={styles.title} accessibilityRole="header">
        {doc.title}
      </Text>
      <Text style={styles.updated}>Last updated {LEGAL_UPDATED}</Text>
      <Text style={styles.intro}>{doc.intro}</Text>

      {doc.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
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
        <View style={styles.section}>
          <Text style={styles.heading} accessibilityRole="header">
            Contact
          </Text>
          <Text style={styles.paragraph}>
            Questions, or a request about your data or these terms: {CONTACT_EMAIL}
          </Text>
        </View>
      ) : null}

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 64, ...column },
  title: { ...type.display, color: colors.text },
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
