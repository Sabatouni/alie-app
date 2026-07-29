import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { session, isAdmin, loading, signOut } = useAuth();

  // `loading` now covers the profile fetch as well as the session, so this
  // branch holds the whole way through sign-in. Nothing below can be reached
  // with an unresolved profile.
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-paper text-ink/50 text-sm">Checking your access…</div>;
  }

  if (!session) return <Navigate to="/admin/login" replace />;

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-paper text-center px-6">
        <h1 className="font-display text-2xl text-ink">No admin access on this account</h1>
        <p className="text-sm text-ink/55 mt-3 max-w-sm leading-relaxed">
          You're signed in, but this account has no admin role. Ask an existing admin to set your
          role, then sign in again.
        </p>
        <button onClick={signOut} className="btn-secondary mt-7">Sign out</button>
      </div>
    );
  }

  return children;
}
