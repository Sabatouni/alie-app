import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchApplicationMembers, grantRoleByEmail, revokeRole } from '../../lib/permissions';
import { useToast } from '../../context/ToastContext';

const APP_SLUG = 'alie-web';
const ROLES = ['admin', 'owner']; // no Worker tier for alie-web

export default function Team() {
  const { session, isOwner } = useAuth();
  const toast = useToast();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('admin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    try {
      setMembers(await fetchApplicationMembers(APP_SLUG));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  // Route is already gated by AdminRoute (must be a real admin to get this
  // far), but Team management itself is Owner-only -- direct-URL typing by
  // a non-owner Admin still lands here, so guard again explicitly.
  if (!isOwner) return <Navigate to="/admin" replace />;

  async function submitGrant(e) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return;
    setBusy(true);
    try {
      await grantRoleByEmail(email.trim(), APP_SLUG, role);
      setEmail('');
      await load();
      toast.success('Access granted');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(userId) {
    if (!confirm('Remove this person\'s access to the ALIÈ admin?')) return;
    try {
      await revokeRole(userId, APP_SLUG);
      await load();
      toast.success('Access revoked');
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl text-ink mb-1">Team</h1>
      <p className="text-sm text-ink/55 mb-8">People with access to the ALIÈ admin dashboard.</p>

      {loading ? (
        <p className="text-sm text-ink/50">Loading…</p>
      ) : (
        <table className="w-full text-sm mb-10">
          <thead>
            <tr className="text-left text-ink/40 uppercase text-xs tracking-wide border-b border-ink/10">
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Added</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.user_id} className="border-b border-ink/5">
                <td className="py-3 pr-4">{m.email}</td>
                <td className="py-3 pr-4">{m.full_name || '—'}</td>
                <td className="py-3 pr-4 capitalize">{m.role_slug}</td>
                <td className="py-3 pr-4 text-ink/50">{m.granted_at ? new Date(m.granted_at).toLocaleDateString() : '—'}</td>
                <td className="py-3 text-right">
                  {m.user_id !== session?.user?.id && (
                    <button onClick={() => handleRevoke(m.user_id)} className="text-clay text-xs hover:underline">
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-ink/40">No team members yet.</td></tr>
            )}
          </tbody>
        </table>
      )}

      <div className="border-t border-ink/10 pt-8">
        <h2 className="font-display text-lg text-ink mb-2">Grant access</h2>
        <p className="text-sm text-ink/55 mb-5 max-w-md">
          Enter the email of an existing account (they must already have signed up, or been created in
          Supabase Auth) and choose a role. Granting a role a second time replaces their existing one.
        </p>
        <form onSubmit={submitGrant} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs uppercase tracking-wide text-ink/50 mb-1.5" htmlFor="team-email">Email</label>
            <input
              id="team-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-ink/15 rounded px-3 py-2 text-sm"
              placeholder="teammate@alie.co"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-ink/50 mb-1.5" htmlFor="team-role">Role</label>
            <select id="team-role" value={role} onChange={(e) => setRole(e.target.value)} className="border border-ink/15 rounded px-3 py-2 text-sm">
              {ROLES.map((r) => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}
            </select>
          </div>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? 'Granting…' : 'Grant access'}
          </button>
        </form>
        {error && <p role="alert" className="mt-3 text-sm text-clay">{error}</p>}
      </div>
    </div>
  );
}
