import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  // loading stays true until BOTH the session AND the profile (if any) are resolved.
  // Without this, ProtectedRoute can see isAdmin=false for a brief window while the
  // profile is still fetching and redirect the user away from the admin.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore an existing session on mount.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      // If there is no session we are done loading immediately (no profile to fetch).
      if (!data.session) setLoading(false);
    });

    // Keep session in sync with auth state changes (sign-in, sign-out, token refresh).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // Fetch the user's profile whenever the session changes.
  // We keep loading=true until this resolves so ProtectedRoute never sees
  // an intermediate isAdmin=false state.
  useEffect(() => {
    if (!session?.user) return; // handled in the session effect above

    supabase
      .from('alie_profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error && error.code !== 'PGRST116') {
          // PGRST116 = no rows returned (profile not created yet)
          console.warn('[AuthContext] profile fetch error:', error);
        }
        setProfile(data ?? null);
        setLoading(false);
      });
  }, [session]);

  const value = {
    session,
    profile,
    isAdmin: profile?.role === 'admin',
    loading,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
