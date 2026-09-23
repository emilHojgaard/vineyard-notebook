import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export function LoginPage() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signup, login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignup) {
        if (!displayName.trim()) {
          setError('Please enter your name');
          setLoading(false);
          return;
        }
        await signup(email, password, displayName);
      } else {
        await login(email, password);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-page-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-burgundy mb-2">
            Vineyard Notebook
          </h1>
          <p className="text-ink-soft text-sm">
            Track your winemaking journey from vine to bottle
          </p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6 shadow-phone">
          <h2 className="text-xl font-semibold text-ink mb-6">
            {isSignup ? 'Create Account' : 'Sign In'}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-status-need rounded-lg text-status-need text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div>
                <label className="block text-xs uppercase tracking-wider text-ink-faint mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-parchment text-ink focus:outline-none focus:ring-2 focus:ring-focus-ring"
                  placeholder="Captain"
                  required={isSignup}
                />
              </div>
            )}

            <div>
              <label className="block text-xs uppercase tracking-wider text-ink-faint mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg bg-parchment text-ink focus:outline-none focus:ring-2 focus:ring-focus-ring"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-ink-faint mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg bg-parchment text-ink focus:outline-none focus:ring-2 focus:ring-focus-ring"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-burgundy text-white rounded-lg font-semibold hover:bg-burgundy-deep transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Please wait...' : isSignup ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsSignup(!isSignup);
                setError('');
              }}
              className="text-sm text-burgundy hover:underline"
            >
              {isSignup
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
