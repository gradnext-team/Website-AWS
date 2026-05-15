import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Target, Mail, Lock, ArrowRight, CheckCircle, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// ═══════════════════════════════════════════
// LOGIN PAGE (Email + Password)
// ═══════════════════════════════════════════

const CRMLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Check if already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/crm/auth/me`, { withCredentials: true });
        if (res.data?.user) {
          navigate('/crm');
        }
      } catch {
        // Not authenticated, show login
      }
    };
    checkAuth();
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    try {
      setLoading(true);
      setError('');
      await axios.post(`${BACKEND_URL}/api/crm/auth/login`, {
        email: email.trim(),
        password
      }, { withCredentials: true });
      navigate('/crm');
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">gradnext</h1>
          <p className="text-sm text-slate-500 mt-1">CRM Portal</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <h2 className="text-lg font-semibold text-slate-900 text-center mb-6">Sign in to your account</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="w-4.5 h-4.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4.5 h-4.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/25"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Admin link */}
        <p className="text-center mt-6 text-xs text-slate-400">
          Admin? <a href="/admin" className="text-blue-500 hover:text-blue-600 font-medium">Login via Admin Panel</a>
        </p>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
// ACCOUNT SETUP PAGE (Set Password after invite)
// ═══════════════════════════════════════════

const CRMSetup = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('loading'); // loading, ready, setting, success, error
  const [error, setError] = useState('');
  const [repInfo, setRepInfo] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  // Verify token on mount
  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setStatus('error');
        setError('No setup token provided');
        return;
      }

      try {
        const res = await axios.get(`${BACKEND_URL}/api/crm/auth/verify-invite?token=${token}`, { withCredentials: true });
        setRepInfo(res.data);
        setStatus('ready');
      } catch (err) {
        setStatus('error');
        setError(err.response?.data?.detail || 'Invalid or expired setup link');
      }
    };

    verify();
  }, [token]);

  const handleSetPassword = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setStatus('setting');
      setError('');
      await axios.post(`${BACKEND_URL}/api/crm/auth/setup-password`, {
        token,
        password
      }, { withCredentials: true });
      setStatus('success');
      setTimeout(() => navigate('/crm'), 2000);
    } catch (err) {
      setStatus('ready');
      setError(err.response?.data?.detail || 'Failed to set password');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">gradnext</h1>
          <p className="text-sm text-slate-500 mt-1">CRM Portal</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          {status === 'loading' && (
            <div className="text-center py-6">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500">Verifying your invite...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Setup Link Invalid</h3>
              <p className="text-sm text-slate-500 mb-6">{error}</p>
              <p className="text-xs text-slate-400">Contact your admin to get a new invite link.</p>
            </div>
          )}

          {(status === 'ready' || status === 'setting') && repInfo && (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-3">
                  <span className="text-white text-xl font-bold">{repInfo.name?.charAt(0)?.toUpperCase()}</span>
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Welcome, {repInfo.name}!</h3>
                <p className="text-sm text-slate-500">Set your password to get started</p>
              </div>

              <form onSubmit={handleSetPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                  <input type="email" value={repInfo.email} disabled
                    className="w-full px-3 py-3 rounded-xl border border-slate-200 text-sm bg-slate-50 text-slate-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Create Password</label>
                  <div className="relative">
                    <Lock className="w-4.5 h-4.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                      autoFocus
                      className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    className="w-full px-3 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === 'setting' || !password || !confirmPassword}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/25"
                >
                  {status === 'setting' ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Setting up...</>
                  ) : (
                    <>Set Password & Sign In</>
                  )}
                </button>
              </form>
            </>
          )}

          {status === 'success' && (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">You're all set!</h3>
              <p className="text-sm text-slate-500">Redirecting to your CRM dashboard...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export { CRMLogin, CRMSetup };
