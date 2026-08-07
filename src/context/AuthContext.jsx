import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchMyPermissions, ROLE_LEVELS } from '../lib/permissions';

// ALIÈ Website only. Owner and Admin exist here; there is no Worker tier
// for this application. A user's standing in stv-pos, numa-web,
// ulphoria-web, or stv-web has zero bearing on this app -- the grant
// lookup below only ever reads the row matching this slug.
const APP_SLUG = 'alie-web';

const AuthContext = createContext(null);

// Auth resolves in two steps: the session, then the permission grant that
// decides clearance. `loading` must stay true across BOTH, otherwise
// ProtectedRoute sees session=truthy / isAdmin=false for the gap in between
// and flashes "your account doesn't have admin access" at a perfectly valid
// admin.
//
// That gap is exactly what the old code left open: after signIn() the
// session arrived via onAuthStateChange while `loading` was already false
// from the initial getSession() pass, so the profile fetch ran unguarded.

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Bumped on every session change. A permissions response whose ticket no
  // longer matches belongs to a superseded session and is discarded -- this
  // is what stops a slow response for user A from granting clearance under
  // user B.
  const ticket = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    // onAuthStateChange fires immediately with INITIAL_SESSION in
    // supabase-js v2, so it covers restore-on-refresh as well as sign-in
    // and token refresh. Subscribing alone is enough; a separate
    // getSession() would only duplicate it.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!alive.current) return;
      ticket.current += 1;
      setSession(nextSession ?? null);
      // Every transition reopens the loading window until permissions settle.
      setLoading(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const myTicket = ticket.current;

    if (!session?.user) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    fetchMyPermissions()
      .then((perms) => {
        // Stale response, or the component went away -- drop it.
        if (cancelled || !alive.current || myTicket !== ticket.current) return;
        setPermissions(perms);
        setLoading(false);
      })
      .catch((error) => {
        if (cancelled || !alive.current || myTicket !== ticket.current) return;
        console.warn('[AuthContext] permissions fetch error:', error.message);
        setPermissions([]);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [session]);

  const signIn = useCallback((email, password) => supabase.auth.signInWithPassword({ email, password }), []);
  const signOut = useCallback(() => supabase.auth.signOut(), []);
  const refresh = useCallback(async () => {
    setPermissions(await fetchMyPermissions());
  }, []);

  const grant = useMemo(
    () => permissions.find((p) => p.application_slug === APP_SLUG) || null,
    [permissions]
  );
  const role = grant?.role_slug || null;
  const roleLevel = role ? (ROLE_LEVELS[role] ?? grant.role_level) : null;

  const value = useMemo(
    () => ({
      session,
      permissions,
      role,
      roleLevel,
      hasAccess: !!grant,
      isAdmin: roleLevel !== null && roleLevel >= ROLE_LEVELS.admin, // admin-or-above
      isOwner: role === 'owner',
      loading,
      signIn,
      signOut,
      refresh,
    }),
    [session, permissions, role, roleLevel, grant, loading, signIn, signOut, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
