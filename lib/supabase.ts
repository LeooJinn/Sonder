/**
 * The Supabase client.
 *
 * Configuration comes from environment variables rather than being hardcoded,
 * so the repo carries no project-specific values and a second environment
 * (staging, a contributor's own project) is a config change, not a code change.
 *
 * Expo exposes any variable prefixed EXPO_PUBLIC_ to the app at build time.
 * That prefix is a warning as much as a convenience: these values are baked
 * into the shipped bundle and anyone can read them out of an installed app.
 * The anon key is designed for that — it grants only what row-level security
 * policies allow. Never put the service_role key here.
 */

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly at startup rather than with a confusing network error later.
  throw new Error(
    'Missing Supabase config. Copy .env.example to .env and fill in your project URL and anon key.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Sessions live in AsyncStorage so a signed-in user stays signed in
    // across app restarts.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Only relevant on the web, where auth callbacks arrive as URL fragments.
    // On native the session comes back through the deep link instead.
    detectSessionInUrl: false,
  },
});
