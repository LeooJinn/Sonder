import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../lib/theme';

/**
 * The root layout wraps every screen in the app.
 *
 * <Stack> is a navigator: screens sit on a stack, pushing on top of each
 * other, and the back button pops them. Options set here apply to all
 * screens; each screen can override them with its own <Stack.Screen>.
 */
export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </>
  );
}
