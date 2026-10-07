import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { changeEmail, changePassword } from '../lib/account';
import { describeError } from '../lib/errors';
import { Button, Field, Notice } from './ui';
import { colors, radius, type } from '../lib/theme';

type Open = 'email' | 'password' | null;

/**
 * Change email and change password, in the account block on Profile. Both ask
 * for the current password first (lib/account.ts). Email only changes once the
 * link Supabase emails is followed, so success says to go and look.
 */
export function AccountSecurity({ email }: { email: string }) {
  const [open, setOpen] = useState<Open>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function toggle(which: Exclude<Open, null>) {
    setOpen(open === which ? null : which);
    setCurrent('');
    setNext('');
    setShowPasswords(false);
    setError(null);
    setNotice(null);
  }

  async function save() {
    if (!open) return;
    setError(null);
    setBusy(true);
    try {
      if (open === 'email') {
        await changeEmail(current, next);
        setNotice(
          `Check ${next.trim()} for a confirmation link. If asked, confirm from ${email} too. Your email changes once you do.`
        );
      } else {
        await changePassword(current, next);
        setNotice('Password changed.');
      }
      setOpen(null);
      setCurrent('');
      setNext('');
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  const reveal = (
    <Button
      label={showPasswords ? 'Hide' : 'Show'}
      variant="subtle"
      onPress={() => setShowPasswords((v) => !v)}
    />
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Button label="Change email" variant="quiet" onPress={() => toggle('email')} />
        <Button label="Change password" variant="quiet" onPress={() => toggle('password')} />
      </View>

      {open && (
        <View style={styles.panel}>
          <Text style={styles.title}>{open === 'email' ? 'Change your email' : 'Change your password'}</Text>
          <Field
            label="Current password"
            value={current}
            onChangeText={(text) => {
              setCurrent(text);
              setError(null);
            }}
            secureTextEntry={!showPasswords}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            autoComplete="current-password"
            accessory={reveal}
          />
          {open === 'email' ? (
            <Field
              label="New email"
              value={next}
              onChangeText={(text) => {
                setNext(text);
                setError(null);
              }}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
            />
          ) : (
            <Field
              label="New password"
              value={next}
              onChangeText={(text) => {
                setNext(text);
                setError(null);
              }}
              placeholder="At least 8 characters"
              secureTextEntry={!showPasswords}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              autoComplete="new-password"
              onSubmitEditing={save}
            />
          )}
          {error && <Notice tone="error">{error}</Notice>}
          <View style={styles.actions}>
            <Button
              label={open === 'email' ? 'Send confirmation' : 'Save new password'}
              variant="secondary"
              onPress={save}
              busy={busy}
            />
            <Button label="Cancel" variant="quiet" onPress={() => toggle(open)} />
          </View>
        </View>
      )}

      {notice && <Notice tone="success">{notice}</Notice>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, marginBottom: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  panel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    padding: 16,
    gap: 12,
  },
  title: { ...type.bodyStrong, color: colors.text },
  actions: { gap: 8 },
});
