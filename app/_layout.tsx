import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../lib/auth';
import { colors } from '../lib/theme';

/**
 * The root layout wraps every screen in the app.
 *
 * AuthProvider has to sit outside the guard, because the guard reads the
 * session from it.
 */
export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RouteGuard />
    </AuthProvider>
  );
}

/**
 * Sends signed-out users to the sign-in screen and signed-in users away
 * from it.
 *
 * The redirect runs in an effect rather than during render because
 * navigating is a side effect — doing it mid-render would mean changing
 * one component's state while another is rendering, which React refuses.
 */
function RouteGuard() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Wait until the stored session has been read, or we'd bounce a
    // signed-in user to sign-in for a frame on every cold start.
    if (loading) return;

    const onSignIn = segments[0] === 'sign-in';

    if (!session && !onSignIn) {
      router.replace('/sign-in');
    } else if (session && onSignIn) {
      router.replace('/');
    }
  }, [session, loading, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
