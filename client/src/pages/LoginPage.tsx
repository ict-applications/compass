import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/Button';

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate(user.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    }
  }, [user, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedInUser = await login(email, password);
      navigate(loggedInUser.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    } catch (err) {
      setError((err as Error).message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#FBF8EE' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold mx-auto mb-4 tracking-tight"
            style={{ background: '#BFF143', color: '#121113' }}
          >
            BG
          </div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Sora, sans-serif' }}>
            Compass Project
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Document compliance, simplified.</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200 p-6 bg-white shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                className="w-full px-3 py-2.5 rounded-lg text-sm text-slate-900 placeholder-slate-400 border border-slate-300 bg-white focus:outline-none focus:border-[#BFF143] focus:ring-1 focus:ring-[#BFF143] transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-lg text-sm text-slate-900 placeholder-slate-400 border border-slate-300 bg-white focus:outline-none focus:border-[#BFF143] focus:ring-1 focus:ring-[#BFF143] transition-colors"
              />
            </div>

            {error && (
              <div className="rounded-lg px-3 py-2 text-sm text-red-600 border border-red-200 bg-red-50">
                {error}
              </div>
            )}

            <Button
              type="submit"
              loading={loading}
              className="w-full justify-center py-2.5"
            >
              Sign in
            </Button>
          </form>
        </div>

        <p className="text-center text-slate-400 text-xs mt-6">
          Compass Project · Enterprise Compliance Platform
        </p>
      </div>
    </div>
  );
}
