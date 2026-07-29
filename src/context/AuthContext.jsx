import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

// Auth resolves in two steps: the session, then the admin profile that decides
// clearance. `loading` must stay true across BOTH, otherwise ProtectedRoute sees
// session=truthy / isAdmin=false for the gap in between and flashes
// "your account doesn't have admin access" at a perfectly valid admin.
//
// That gap is exactly what the old code left open: after signIn() the session
// arrived via onAuthStateChange while `loading` was already false from the
// initial getSession() pass, so the profile fetch ran unguarded.

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Bumped on every session change. A profile response whose ticket no longer
  // matches belongs to a superseded session and is discarded — this is what
  // stops a slow response for user A from granting clearance under user B.
  const ticket = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    // onAuthStateChange fires immediately with INITIAL_SESSION in supabase-js v2,
    // so it covers restore-on-refresh as well as sign-in and token refresh.
    // Subscribing alone is enough; a separate getSession() would only duplicate it.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!alive.current) return;
      ticket.current += 1;
      setSession(nextSession ?? null);
      // Every transition reopens the loading window until the profile settles.
      setLoading(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const myTicket = ticket.current;

    if (!session?.user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    supabase
      .from('alie_profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        // Stale response, or the component went away — drop it.
        if (cancelled || !alive.current || myTicket !== ticket.current) return;
        if (error) console.warn('[AuthContext] profile fetch error:', error);
        setProfile(data ?? null);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [session]);

  const signIn = useCallback((email, password) => supabase.auth.signInWithPassword({ email, password }), []);
  const signOut = useCallback(() => supabase.auth.signOut(), []);

  const value = useMemo(
    () => ({
      session,
      profile,
      isAdmin: profile?.role === 'admin',
      loading,
      signIn,
      signOut,
    }),
    [session, profile, loading, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
