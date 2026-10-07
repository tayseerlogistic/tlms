import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Shield, Lock, LogIn, AlertCircle, Sparkles,
  CheckCircle2, Truck
} from 'lucide-react';

interface LoginViewProps {
  onSuccess?: () => void;
  onExploreGuest?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess, onExploreGuest }) => {
  const { loginWithEmail, loginWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Please provide both your corporate email and password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await loginWithEmail(email.trim(), password);
      if (!res.success) {
        setError(res.error || 'Failed to authenticate. Please check your credentials.');
      } else {
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected authentication error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleLoading(true);
    try {
      await loginWithGoogle();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Google sign-in was cancelled or failed.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        {/* Glow accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="text-center mb-6 relative">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 text-white shadow-xl shadow-blue-500/25 mb-3 text-2xl font-bold font-mono">
            ⚡
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white font-mono tracking-tight">
            TLS LOGISTICS HUB
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Tayseer Group Central Fleet Operating System
          </p>
        </div>

        {/* Locked Registration Badge */}
        <div className="mb-6 p-3 bg-slate-950/80 border border-rose-500/30 rounded-2xl flex items-start gap-2.5 shadow-inner">
          <div className="p-1 bg-rose-500/20 text-rose-400 rounded-lg shrink-0 mt-0.5">
            <Lock className="w-3.5 h-3.5" />
          </div>
          <div className="text-left">
            <div className="text-[11px] font-bold text-rose-300 font-mono uppercase tracking-wider flex items-center gap-1.5">
              <span>Public Sign-Up Locked</span>
              <span className="text-[9px] bg-rose-950 text-rose-400 border border-rose-500/40 px-1.5 py-0.2 rounded font-sans">
                Admin-Only
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              Self-registration is disabled. User accounts with roles (<span className="text-indigo-300">Editor</span>, <span className="text-cyan-300">Operator</span>, etc.) are provisioned strictly by Administrators.
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-rose-950/80 border border-rose-500/40 rounded-xl text-xs text-rose-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Corporate Email</label>
            <input
              type="email"
              placeholder="e.g. admin@tls.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono transition"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300">Password</label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-slate-400 hover:text-slate-200 transition"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your account password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono transition"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || isGoogleLoading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Authenticating...
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <LogIn className="w-4 h-4" /> Sign In to Fleet Portal
              </span>
            )}
          </button>
        </form>

        {/* Alternative Google Sign-In */}
        <div className="mt-4 pt-4 border-t border-slate-800/80">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isLoading}
            className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold py-2 rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition"
          >
            <span className="text-xs">G</span> Sign in with Google (Authorized Accounts)
          </button>
        </div>

        {/* Optional Explore in Read-Only Mode */}
        {onExploreGuest && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={onExploreGuest}
              className="text-[11px] text-slate-400 hover:text-slate-200 underline font-mono transition"
            >
              Continue in View-Only Guest Mode &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
