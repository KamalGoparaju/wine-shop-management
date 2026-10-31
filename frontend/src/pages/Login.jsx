import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, AlertCircle, Loader2, Server, RefreshCw } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('admin@wineshop.com');
  const [password, setPassword] = useState('Admin@123');
  const [error, setError] = useState('');
  const [isServerStarting, setIsServerStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setError('');
    setIsServerStarting(false);
    setSubmitting(true);

    // If server takes longer than 3.5s, it is likely cold-booting on Render free tier
    const coldBootTimer = setTimeout(() => {
      setIsServerStarting(true);
    }, 3500);

    try {
      const res = await login(email, password);
      clearTimeout(coldBootTimer);
      if (res.success) {
        navigate('/dashboard');
      }
    } catch (err) {
      clearTimeout(coldBootTimer);
      setIsServerStarting(false);
      const msg = err?.message || 'Login failed. Please check your credentials.';
      setError(msg);
    } finally {
      clearTimeout(coldBootTimer);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-3 sm:p-6 selection:bg-amber-600/30 selection:text-amber-200">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-amber-600/20 border border-amber-500/30 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 text-2xl sm:text-3xl shadow-lg shadow-amber-950/30">
            🍷
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Wine Shop Management</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">Sign in to manage inventory & sales</p>
        </div>

        {isServerStarting && (
          <div className="p-3.5 sm:p-4 rounded-xl bg-amber-950/40 border border-amber-700/50 text-amber-300 text-xs sm:text-sm flex items-start gap-3 animate-pulse">
            <Server className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-200">Waking up backend server...</p>
              <p className="text-[11px] sm:text-xs text-amber-300/80 mt-0.5">
                The Render server spins down after inactivity. The first connect takes ~30–50s. Please hold on...
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3.5 sm:p-4 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs sm:text-sm flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-rose-400" />
              <span className="font-medium">{error}</span>
            </div>
            {(error.includes('waking up') || error.includes('busy') || error.includes('reach')) && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="mt-1 self-start inline-flex items-center gap-1.5 px-3 py-1 bg-rose-900/60 hover:bg-rose-800 text-rose-200 rounded-lg text-xs font-semibold transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Connection
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 sm:w-5 sm:h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@wineshop.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 sm:py-3 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-xs sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 sm:w-5 sm:h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 sm:py-3 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-xs sm:text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl shadow-lg shadow-amber-900/30 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 text-xs sm:text-sm mt-2 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>{isServerStarting ? 'Waking up server (~30s)...' : 'Signing in...'}</span>
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-800 text-center">
          <p className="text-[11px] sm:text-xs text-slate-500">
            Default Admin:{' '}
            <button
              type="button"
              onClick={() => {
                setEmail('admin@wineshop.com');
                setPassword('Admin@123');
              }}
              className="text-amber-400 hover:text-amber-300 font-mono underline decoration-dotted underline-offset-2 cursor-pointer transition-colors"
            >
              admin@wineshop.com / Admin@123
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
