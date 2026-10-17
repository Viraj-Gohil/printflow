import React, { useState } from 'react';
import { useApp } from '../../lib/store';
import { Shield, Lock, Mail, ArrowRight, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { validateEmail, validatePassword } from '../../lib/validation';

export const AdminLogin: React.FC = () => {
  const { adminLogin, navigate, currentUser } = useApp();
  const [email, setEmail] = useState('admin@printflow.io');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already logged in as admin, offer to jump directly
  if (currentUser?.role === 'ADMIN') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 bg-[#f8fafc]">
        <div className="max-w-md w-full bg-white p-7 rounded-3xl border border-purple-200 shadow-md text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Already Authenticated as Admin</h2>
          <p className="text-xs text-slate-500">
            You are currently signed in as <strong>{currentUser.fullName}</strong> ({currentUser.email}).
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Go to Admin Console
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Back to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  const emailError = touched.email ? validateEmail(email).error : undefined;
  const passwordError = touched.password ? (!password.trim() ? 'Password is required.' : undefined) : undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTouched({ email: true, password: true });

    const emailCheck = validateEmail(email);
    if (!emailCheck.isValid) {
      setError(emailCheck.error || 'Please enter a valid admin email.');
      return;
    }
    if (!password.trim()) {
      setError('Please enter your administrator password.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const res = adminLogin(email, password);
      setIsSubmitting(false);
      if (!res.success) {
        setError(res.message || 'Invalid administrator credentials.');
      }
    }, 400);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#f8fafc]">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-13 h-13 rounded-2xl bg-purple-600 text-white flex items-center justify-center mx-auto shadow-sm">
            <Shield className="w-7 h-7" />
          </div>
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-200 inline-block">
            Fixed URL: /admin/login
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Platform Master Admin
          </h1>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Restricted access for platform administrators, multi-tenant governance, and billing.
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Admin Login Form with Inline Validation */}
        <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">
                Admin Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="admin@printflow.io"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (touched.email) setTouched((p) => ({ ...p, email: true }));
                  }}
                  onBlur={() => setTouched((p) => ({ ...p, email: true }))}
                  className={`w-full pl-9 pr-3.5 h-11 bg-slate-50 border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:bg-white transition-all font-mono ${
                    emailError ? 'border-red-400 focus:ring-red-400 bg-red-50/20' : 'border-slate-200 focus:ring-purple-600'
                  }`}
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              </div>
              {emailError && (
                <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{emailError}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">
                Master Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="Enter administrator password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (touched.password) setTouched((p) => ({ ...p, password: true }));
                  }}
                  onBlur={() => setTouched((p) => ({ ...p, password: true }))}
                  className={`w-full pl-9 pr-3.5 h-11 bg-slate-50 border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:bg-white transition-all font-mono ${
                    passwordError ? 'border-red-400 focus:ring-red-400 bg-red-50/20' : 'border-slate-200 focus:ring-purple-600'
                  }`}
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              </div>
              {passwordError && (
                <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{passwordError}</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <span>{isSubmitting ? 'Authenticating...' : 'Sign In to Super Admin'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </button>
            <button
              onClick={() => navigate('/auth/login')}
              className="text-blue-600 font-semibold hover:underline cursor-pointer"
            >
              Shop Owner Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
