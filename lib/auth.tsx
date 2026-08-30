/**
 * Session state, shared across the whole app.
 *
 * React Context is how a value reaches deeply nested components without
 * being passed down through every layer in between. The session is needed
 * in a lot of places, so it lives here rather than being threaded through
 * as props.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

type AuthState = {
  session: Session | null;
  /** True until the stored session has been read. Guards render on this. */
  loading: boolean;
};

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Read whatever session is already stored on the device. This is why a
    // signed-in user isn't asked to log in again after restarting the app.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Then keep it current: fires on sign in, sign out, and token refresh.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    // Cleanup. Without this, every remount would add another listener and
    // the old ones would keep firing against unmounted state.
    return () => subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
