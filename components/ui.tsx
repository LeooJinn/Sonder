import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, fonts, radius, type } from '../lib/theme';

/**
 * React Native Web adds `focused` and `hovered` to the pressable state. The
 * native types only know `pressed`, so this widens them in one place.
 */
export type PressState = { pressed: boolean; focused?: boolean; hovered?: boolean };

/**
 * Text inputs draw their own focus border, so the browser's outline would be
 * a second, clashing ring. Ignored on native, where there is no outline.
 */
export const noOutline = { outlineStyle: 'none' } as unknown as ViewStyle;

/** A visible ring for keyboard focus. Only ever shown on the web. */
export const focusRing = {
  outlineStyle: 'solid',
  outlineWidth: 2,
  outlineColor: colors.accent,
  outlineOffset: 2,
} as unknown as ViewStyle;

type Variant = 'primary' | 'secondary' | 'quiet' | 'subtle' | 'danger';

/**
 * The app's one button.
 *
 * primary is foil, and a viewport shows at most one. secondary is an outline
 * for the other reasonable choice. quiet is inline text in foil, for links
 * that take you forward. subtle is inline text without foil, for everything
 * else inline: cancel, remove, report, show. danger is for actions that
 * destroy something, and is never the most prominent thing on a screen.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  busy,
  disabled,
  style,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const inactive = disabled || busy;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      accessibilityHint={accessibilityHint}
      style={(state) => {
        const { pressed, focused } = state as PressState;
        return [
          styles.base,
          styles[variant],
          disabled && variant === 'primary' && styles.primaryDisabled,
          pressed && styles.pressed,
          focused && focusRing,
          style,
        ];
      }}
    >
      {busy ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onAccent : colors.accent} />
      ) : (
        <Text
          style={[
            styles.text,
            textStyles[variant],
            disabled && variant === 'primary' && styles.primaryDisabledText,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** A label, an input and optional help underneath. */
export function Field({
  label,
  hint,
  error,
  accessory,
  isMono,
  style,
  ...input
}: TextInputProps & {
  label: string;
  hint?: string;
  error?: string | null;
  /** Something small to the right of the label, like a Show toggle. */
  accessory?: ReactNode;
  isMono?: boolean;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {accessory}
      </View>
      <TextInput
        placeholderTextColor={colors.textFaint}
        {...input}
        accessibilityLabel={label}
        onFocus={(e) => {
          setFocused(true);
          input.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          input.onBlur?.(e);
        }}
        style={[
          styles.input,
          noOutline,
          input.multiline && styles.inputMultiline,
          isMono && styles.inputMono,
          focused && styles.inputFocused,
          error ? styles.inputError : null,
          style,
        ]}
      />
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

/** A section title with an optional action on the right. */
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {action}
    </View>
  );
}

/** A message in the flow of a form: what happened, and in which direction. */
export function Notice({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  return (
    <View
      style={[styles.notice, tone === 'error' ? styles.noticeError : styles.noticeSuccess]}
      accessibilityLiveRegion="polite"
    >
      <Text style={[styles.noticeText, tone === 'error' && styles.noticeTextError]}>
        {children}
      </Text>
    </View>
  );
}

/**
 * A screen that couldn't load. Says what went wrong in plain terms and offers
 * the one thing that usually fixes it.
 */
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorState} accessibilityLiveRegion="polite">
      <Text style={styles.errorTitle} accessibilityRole="header">
        This didn&apos;t load
      </Text>
      <Text style={styles.errorBody}>{message}</Text>
      <Button label="Try again" variant="secondary" onPress={onRetry} style={styles.errorButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  errorState: { padding: 24, paddingTop: 64, maxWidth: 440, width: '100%', alignSelf: 'center' },
  errorTitle: { ...type.title, color: colors.text },
  errorBody: { ...type.body, color: colors.textMuted, marginTop: 8 },
  errorButton: { marginTop: 24, alignSelf: 'flex-start' },

  base: {
    minHeight: 52,
    borderRadius: radius.control,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.accent },
  primaryDisabled: { backgroundColor: colors.disabled },
  primaryDisabledText: { color: colors.textFaint },
  secondary: { borderWidth: 1, borderColor: colors.border },
  // Text-sized to the eye, 44pt to the finger. Negative margins cancel the
  // padding so it lays out like plain text; hitSlop alone would do this on
  // native, but React Native Web ignores it.
  subtle: {
    minHeight: 44,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    marginVertical: -12,
    alignItems: 'flex-start',
  },
  quiet: {
    minHeight: 44,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    marginVertical: -12,
    alignItems: 'flex-start',
  },
  danger: { borderWidth: 1, borderColor: colors.dangerLine },
  pressed: { opacity: 0.75 },
  text: { fontFamily: fonts.bodySemi, fontSize: 16 },

  field: { marginBottom: 20 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  label: { ...type.label, color: colors.textMuted },
  input: {
    ...type.body,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  inputMultiline: { minHeight: 104, textAlignVertical: 'top' },
  inputMono: { fontFamily: fonts.mono, fontSize: type.compact.fontSize, letterSpacing: 0.5 },
  inputFocused: { borderColor: colors.accent },
  inputError: { borderColor: colors.danger },
  hint: { ...type.caption, color: colors.textFaint, marginTop: 8 },
  error: { ...type.caption, color: colors.danger, marginTop: 8 },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 14,
  },
  sectionTitle: { ...type.title, color: colors.text },

  notice: { borderRadius: radius.input, padding: 14, marginBottom: 16, borderWidth: 1 },
  noticeError: { borderColor: colors.dangerLine, backgroundColor: colors.dangerWash },
  noticeSuccess: { borderColor: colors.successLine, backgroundColor: colors.successWash },
  noticeText: { ...type.small, color: colors.success },
  noticeTextError: { color: colors.danger },
});

const textStyles = StyleSheet.create({
  primary: { color: colors.onAccent },
  secondary: { color: colors.text },
  quiet: { color: colors.accent, fontSize: type.compact.fontSize },
  subtle: { color: colors.textMuted, fontSize: type.compact.fontSize },
  danger: { color: colors.danger },
});
