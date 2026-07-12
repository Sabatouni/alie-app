import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AdminLogin() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) setError(error.message);
    else navigate('/admin');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-paper p-10">
        <div className="font-display text-2xl tracking-widest2 mb-9 flex items-center gap-2.5 text-ink">
          <svg viewBox="0 0 100 100" className="w-4 h-4 fill-current">
            <path d="M50 5 C54 35,65 46,95 50 C65 54,54 65,50 95 C46 65,35 54,5 50 C35 46,46 35,50 5 Z" />
          </svg>
          ALIÈ Admin
        </div>

        <div className="mb-5">
          <label className="field-label">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input"
            autoComplete="email"
            required
          />
        </div>

        <div className="mb-7">
          <label className="field-label">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input"
            autoComplete="current-password"
            required
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700 mb-5 border border-red-200 bg-red-50 px-3 py-2">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} className="btn-primary w-full text-center">
          {submitting ? 'Signing In…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
