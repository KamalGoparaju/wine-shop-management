import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Lock, Mail, AlertCircle, Loader2, Server, RefreshCw } from 'lucide-react';

const Login = () => {
  const { activeTheme } = useTheme();
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-3 sm:p-6 selection:bg-slate-200">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-6 sm:p-8 space-y-6">
        <div className="text-center">
          <div
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 text-2xl sm:text-3xl shadow-xs border"
            style={{
              backgroundColor: activeTheme.light,
              borderColor: activeTheme.border
            }}
          >
            🍷
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Wine Shop Management</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Sign in to manage inventory & sales</p>
        </div>

        {isServerStarting && (
          <div className="p-3.5 sm:p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs sm:text-sm flex items-start gap-3 animate-pulse">
            <Server className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900">Waking up backend server...</p>
              <p className="text-[11px] sm:text-xs text-amber-700 mt-0.5">
                The Render server spins down after inactivity. The first connect takes ~30–50s. Please hold on...
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3.5 sm:p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-rose-600" />
              <span className="font-medium">{error}</span>
            </div>
            {(error.includes('waking up') || error.includes('busy') || error.includes('reach')) && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="mt-1 self-start inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg text-xs font-semibold transition-colors border border-rose-200"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Connection
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 sm:w-5 sm:h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@wineshop.com"
                className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 sm:py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus-theme transition-all text-xs sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 sm:w-5 sm:h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 sm:py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus-theme transition-all text-xs sm:text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 text-white font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50 text-xs sm:text-sm mt-2 flex items-center justify-center gap-2 hover:opacity-95"
            style={{ backgroundColor: activeTheme.primary }}
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

        <div className="pt-4 border-t border-slate-100 text-center">
          <p className="text-[11px] sm:text-xs text-slate-500">
            Default Admin:{' '}
            <button
              type="button"
              onClick={() => {
                setEmail('admin@wineshop.com');
                setPassword('Admin@123');
              }}
              className="font-mono underline decoration-dotted underline-offset-2 cursor-pointer transition-colors"
              style={{ color: activeTheme.primary }}
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
