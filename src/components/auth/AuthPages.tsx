import React, { useState } from 'react';
import { useApp } from '../../lib/store';
import {
  Printer,
  Shield,
  Store,
  ArrowRight,
  CheckCircle2,
  Lock,
  Mail,
  User,
  Phone,
  MapPin,
  AlertCircle,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  Loader2
} from 'lucide-react';
import {
  validateEmail,
  validatePhone,
  validatePassword,
  validateShopName,
  validateOwnerName,
  validateCity
} from '../../lib/validation';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';

interface AuthPagesProps {
  initialView?: 'login' | 'register' | 'forgot' | 'reset-password';
}

export const AuthPages: React.FC<AuthPagesProps> = ({ initialView = 'login' }) => {
  const { login, registerShop, forgotPassword, resetPassword, navigate, currentUser, plans, logout } = useApp();
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const resetTokenParam = urlParams.get('token');
  const effectiveInitialView = resetTokenParam ? 'reset-password' : initialView;
  const [view, setView] = useState<'login' | 'register' | 'forgot' | 'reset-password'>(effectiveInitialView);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginTouched, setLoginTouched] = useState<{ email?: boolean; password?: boolean }>({});

  // Register form state
  const [registerShopName, setRegisterShopName] = useState('');
  const [registerOwnerName, setRegisterOwnerName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerCity, setRegisterCity] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('plan_free');
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [registerTouched, setRegisterTouched] = useState<Record<string, boolean>>({});

  // Forgot / Reset password form state
  const [forgotEmail, setForgotEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [forgotTouched, setForgotTouched] = useState<Record<string, boolean>>({});
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // Global submission status & safe error message
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already logged in, offer appropriate dashboard navigation
  if (currentUser?.role === 'ADMIN') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 bg-[#f8fafc]">
        <div className="max-w-md w-full bg-white p-7 sm:p-8 rounded-2xl border border-slate-200/90 shadow-2xs text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Signed In as Platform Admin</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              You are signed in as Master Admin (<strong className="text-slate-800">{currentUser.fullName}</strong>). Administrator accounts cannot register or operate individual shops.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <Button
              variant="solid"
              size="md"
              onClick={() => navigate('/admin/dashboard')}
              className="w-full"
            >
              Go to Admin Dashboard
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => logout()}
              className="w-full"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (currentUser?.role === 'SHOP_OWNER') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 bg-[#f8fafc]">
        <div className="max-w-md w-full bg-white p-7 sm:p-8 rounded-2xl border border-slate-200/90 shadow-2xs text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Signed In to Counter</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              You are currently signed in as <strong className="text-slate-800">{currentUser.fullName}</strong>.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <Button
              variant="solid"
              size="md"
              onClick={() => navigate('/shop/dashboard')}
              className="w-full"
            >
              Go to Shop Console
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => navigate('/')}
              className="w-full"
            >
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- STRICT VALIDATION RULES ---

  // Login validations
  const loginEmailError = loginTouched.email ? validateEmail(loginEmail).error : undefined;
  const loginPasswordError = loginTouched.password && !loginPassword ? 'Password is required.' : undefined;

  // Register validations
  const regShopError = registerTouched.shopName ? validateShopName(registerShopName).error : undefined;
  const regOwnerError = registerTouched.ownerName ? validateOwnerName(registerOwnerName).error : undefined;
  const regCityError = registerTouched.city ? validateCity(registerCity).error : undefined;
  const regEmailError = registerTouched.email ? validateEmail(registerEmail).error : undefined;
  const regPhoneError = registerTouched.phone ? validatePhone(registerPhone, true).error : undefined;
  const regPassError = registerTouched.password ? validatePassword(registerPassword, 'Password').error : undefined;
  const regConfirmPassError = registerTouched.confirmPassword
    ? !registerConfirmPassword
      ? 'Please confirm your password.'
      : registerPassword !== registerConfirmPassword
      ? 'Passwords do not match.'
      : undefined
    : undefined;
  const regTermsError = registerTouched.terms && !agreeTerms ? 'You must accept the terms to proceed.' : undefined;

  // Forgot password validations
  const forgotEmailError = forgotTouched.email ? validateEmail(forgotEmail).error : undefined;
  const forgotPassError = forgotTouched.newPassword ? validatePassword(newPassword, 'New Password').error : undefined;
  const forgotConfirmError = forgotTouched.confirmPassword
    ? !confirmNewPassword
      ? 'Please confirm your new password.'
      : newPassword !== confirmNewPassword
      ? 'Passwords do not match.'
      : undefined
    : undefined;

  // Handle Login Submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);

    // Touch all login fields
    setLoginTouched({ email: true, password: true });

    const emailCheck = validateEmail(loginEmail);
    if (!emailCheck.isValid) {
      setErrorMessage(emailCheck.error || 'Please enter a valid email.');
      return;
    }
    if (!loginPassword.trim()) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login(loginEmail, loginPassword);
      setIsSubmitting(false);

      if (!res.success) {
        setErrorMessage(res.message || 'Invalid email or password. Please verify your credentials.');
      }
    } catch {
      setIsSubmitting(false);
      setErrorMessage('Unable to connect to authentication service. Please check your network connection.');
    }
  };

  // Handle Register Submission
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);

    // Touch all fields for error display
    setRegisterTouched({
      shopName: true,
      ownerName: true,
      city: true,
      email: true,
      phone: true,
      password: true,
      confirmPassword: true,
      terms: true
    });

    const shopCheck = validateShopName(registerShopName);
    if (!shopCheck.isValid) {
      setErrorMessage(shopCheck.error || 'Invalid shop name.');
      return;
    }

    const ownerCheck = validateOwnerName(registerOwnerName);
    if (!ownerCheck.isValid) {
      setErrorMessage(ownerCheck.error || 'Invalid owner name.');
      return;
    }

    const cityCheck = validateCity(registerCity);
    if (!cityCheck.isValid) {
      setErrorMessage(cityCheck.error || 'Invalid city.');
      return;
    }

    const emailCheck = validateEmail(registerEmail);
    if (!emailCheck.isValid) {
      setErrorMessage(emailCheck.error || 'Invalid email.');
      return;
    }

    const phoneCheck = validatePhone(registerPhone, true);
    if (!phoneCheck.isValid) {
      setErrorMessage(phoneCheck.error || 'Invalid mobile number.');
      return;
    }

    const passCheck = validatePassword(registerPassword);
    if (!passCheck.isValid) {
      setErrorMessage(passCheck.error || 'Invalid password.');
      return;
    }

    if (registerPassword !== registerConfirmPassword) {
      setErrorMessage('Passwords do not match. Please verify.');
      return;
    }

    if (!agreeTerms) {
      setErrorMessage('Please agree to the service terms to create your account.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await registerShop({
        shopName: registerShopName.trim(),
        ownerName: registerOwnerName.trim(),
        email: registerEmail.trim(),
        phone: registerPhone.trim(),
        city: registerCity.trim(),
        password: registerPassword,
        planId: selectedPlanId
      });
      setIsSubmitting(false);
      if (!res.success) {
        setErrorMessage(res.message || 'Registration failed. Please check your details and try again.');
      }
    } catch {
      setIsSubmitting(false);
      setErrorMessage('Registration request failed. Please check your network connection.');
    }
  };

  // Handle Forgot Password Request Submission
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);

    setForgotTouched({ email: true });

    const emailCheck = validateEmail(forgotEmail);
    if (!emailCheck.isValid) {
      setErrorMessage(emailCheck.error || 'Invalid email.');
      return;
    }

    setIsSubmitting(true);
    try {
      await forgotPassword(forgotEmail);
      setIsSubmitting(false);
      setForgotSuccess(true);
    } catch {
      setIsSubmitting(false);
      setForgotSuccess(true);
    }
  };

  // Handle Password Reset Submission via Token Link
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);

    setForgotTouched({ newPassword: true, confirmPassword: true });

    const passCheck = validatePassword(newPassword, 'New Password');
    if (!passCheck.isValid) {
      setErrorMessage(passCheck.error || 'Invalid password.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    const token = resetTokenParam;
    if (!token) {
      setErrorMessage('Missing password reset token.');
      return;
    }

    setIsSubmitting(true);
    const res = await resetPassword(token, newPassword);
    setIsSubmitting(false);

    if (res.success) {
      setForgotSuccess(true);
    } else {
      setErrorMessage(res.message || 'Failed to reset password.');
    }
  };

  const activePlan = plans.find((p) => p.id === selectedPlanId) || plans[0] || {
    id: 'plan_free',
    name: 'Free Starter',
    priceMonthly: 0,
    printerLimit: 1
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8 bg-slate-50/60">
      <div className={`w-full space-y-5 ${view === 'register' ? 'max-w-[540px]' : 'max-w-[420px]'}`}>
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-2xs">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-blue-600">
              PrintFlow Shop Console
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
              {view === 'login'
                ? 'Sign in to Shop Console'
                : view === 'register'
                ? 'Register Your Shop'
                : 'Reset Your Password'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
              {view === 'login'
                ? 'Manage your counter, print jobs, and pricing.'
                : view === 'register'
                ? 'Start cloud QR ordering for your counter in 2 minutes.'
                : 'Enter your registered email and choose a new password.'}
            </p>
          </div>
        </div>

        {/* Server & Global Error Notification */}
        {errorMessage && (
          <div
            role="alert"
            className="p-3 bg-red-50 border border-red-200/80 rounded-xl text-xs text-red-700 font-medium flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <div className="flex-1 leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Form Card Container */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
          {/* ========================================================= */}
          {/* 1. SIGN IN VIEW                                           */}
          {/* ========================================================= */}
          {view === 'login' && (
            <form onSubmit={handleLogin} noValidate className="space-y-4">
              {/* Email Address */}
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="block text-xs font-semibold text-slate-800">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@printflow.io"
                    value={loginEmail}
                    onChange={(e) => {
                      setLoginEmail(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    onBlur={() => setLoginTouched((prev) => ({ ...prev, email: true }))}
                    aria-invalid={!!loginEmailError}
                    aria-describedby={loginEmailError ? 'login-email-error' : undefined}
                    disabled={isSubmitting}
                    className={`w-full pl-9 pr-3.5 h-10 sm:h-11 bg-white border rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                      loginEmailError
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/20'
                        : 'border-slate-200 focus:border-blue-600 focus:ring-blue-600/20'
                    }`}
                  />
                </div>
                {loginEmailError && (
                  <p id="login-email-error" role="alert" className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{loginEmailError}</span>
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="login-password" className="text-xs font-semibold text-slate-800">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setView('forgot');
                    }}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-password"
                    name="password"
                    type={showLoginPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    onBlur={() => setLoginTouched((prev) => ({ ...prev, password: true }))}
                    aria-invalid={!!loginPasswordError}
                    aria-describedby={loginPasswordError ? 'login-password-error' : undefined}
                    disabled={isSubmitting}
                    className={`w-full pl-9 pr-10 h-10 sm:h-11 bg-white border rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                      loginPasswordError
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/20'
                        : 'border-slate-200 focus:border-blue-600 focus:ring-blue-600/20'
                    }`}
                  />
                  <button
                    type="button"
                    tabIndex={0}
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none focus:text-slate-700 p-1 rounded-md transition-colors"
                    aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {loginPasswordError && (
                  <p id="login-password-error" role="alert" className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{loginPasswordError}</span>
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="solid"
                size="lg"
                disabled={isSubmitting}
                className="w-full mt-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Shop</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* ========================================================= */}
          {/* 2. SHOP REGISTRATION VIEW                                 */}
          {/* ========================================================= */}
          {view === 'register' && (
            <form onSubmit={handleRegister} noValidate className="space-y-4">
              {/* Group 1: Business Details */}
              <div className="space-y-3">
                <span className="text-[11px] uppercase font-mono tracking-wider font-semibold text-slate-400 block border-b border-slate-100 pb-1">
                  1. Shop Business Details
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="reg-shop-name" className="block text-xs font-semibold text-slate-800">
                      Shop Business Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Store className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reg-shop-name"
                        name="shopName"
                        type="text"
                        placeholder="e.g. City Xerox & Prints"
                        value={registerShopName}
                        onChange={(e) => setRegisterShopName(e.target.value)}
                        onBlur={() => setRegisterTouched((p) => ({ ...p, shopName: true }))}
                        aria-invalid={!!regShopError}
                        aria-describedby={regShopError ? 'reg-shop-error' : undefined}
                        disabled={isSubmitting}
                        className={`w-full pl-9 pr-3 h-10 bg-white border rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                          regShopError
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/20'
                            : 'border-slate-200 focus:border-blue-600 focus:ring-blue-600/20'
                        }`}
                      />
                    </div>
                    {regShopError && (
                      <p id="reg-shop-error" role="alert" className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{regShopError}</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="reg-city" className="block text-xs font-semibold text-slate-800">
                      City / Location <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reg-city"
                        name="city"
                        type="text"
                        placeholder="e.g. Pune, MH"
                        value={registerCity}
                        onChange={(e) => setRegisterCity(e.target.value)}
                        onBlur={() => setRegisterTouched((p) => ({ ...p, city: true }))}
                        aria-invalid={!!regCityError}
                        aria-describedby={regCityError ? 'reg-city-error' : undefined}
                        disabled={isSubmitting}
                        className={`w-full pl-9 pr-3 h-10 bg-white border rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                          regCityError
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/20'
                            : 'border-slate-200 focus:border-blue-600 focus:ring-blue-600/20'
                        }`}
                      />
                    </div>
                    {regCityError && (
                      <p id="reg-city-error" role="alert" className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{regCityError}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Group 2: Owner & Contact */}
              <div className="space-y-3">
                <span className="text-[11px] uppercase font-mono tracking-wider font-semibold text-slate-400 block border-b border-slate-100 pb-1">
                  2. Owner & Contact Information
                </span>

                <div className="space-y-1.5">
                  <label htmlFor="reg-owner-name" className="block text-xs font-semibold text-slate-800">
                    Owner Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="reg-owner-name"
                      name="ownerName"
                      type="text"
                      autoComplete="name"
                      placeholder="Your full name"
                      value={registerOwnerName}
                      onChange={(e) => setRegisterOwnerName(e.target.value)}
                      onBlur={() => setRegisterTouched((p) => ({ ...p, ownerName: true }))}
                      aria-invalid={!!regOwnerError}
                      aria-describedby={regOwnerError ? 'reg-owner-error' : undefined}
                      disabled={isSubmitting}
                      className={`w-full pl-9 pr-3 h-10 bg-white border rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                        regOwnerError
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/20'
                          : 'border-slate-200 focus:border-blue-600 focus:ring-blue-600/20'
                      }`}
                    />
                  </div>
                  {regOwnerError && (
                    <p id="reg-owner-error" role="alert" className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{regOwnerError}</span>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-800">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reg-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="shop@email.com"
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        onBlur={() => setRegisterTouched((p) => ({ ...p, email: true }))}
                        aria-invalid={!!regEmailError}
                        aria-describedby={regEmailError ? 'reg-email-error' : undefined}
                        disabled={isSubmitting}
                        className={`w-full pl-9 pr-3 h-10 bg-white border rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                          regEmailError
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/20'
                            : 'border-slate-200 focus:border-blue-600 focus:ring-blue-600/20'
                        }`}
                      />
                    </div>
                    {regEmailError && (
                      <p id="reg-email-error" role="alert" className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{regEmailError}</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="reg-phone" className="block text-xs font-semibold text-slate-800">
                      Mobile (10 Digits) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reg-phone"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        maxLength={10}
                        placeholder="9876543210"
                        value={registerPhone}
                        onChange={(e) => setRegisterPhone(e.target.value.replace(/\D/g, ''))}
                        onBlur={() => setRegisterTouched((p) => ({ ...p, phone: true }))}
                        aria-invalid={!!regPhoneError}
                        aria-describedby={regPhoneError ? 'reg-phone-error' : undefined}
                        disabled={isSubmitting}
                        className={`w-full pl-9 pr-3 h-10 bg-white border rounded-xl text-xs sm:text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                          regPhoneError
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/20'
                            : 'border-slate-200 focus:border-blue-600 focus:ring-blue-600/20'
                        }`}
                      />
                    </div>
                    {regPhoneError && (
                      <p id="reg-phone-error" role="alert" className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{regPhoneError}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Group 3: Account Credentials */}
              <div className="space-y-3">
                <span className="text-[11px] uppercase font-mono tracking-wider font-semibold text-slate-400 block border-b border-slate-100 pb-1">
                  3. Account Credentials
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="reg-password" className="block text-xs font-semibold text-slate-800">
                      Create Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reg-password"
                        name="password"
                        type={showRegisterPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Min 6 characters"
                        value={registerPassword}
                        onChange={(e) => setRegisterPassword(e.target.value)}
                        onBlur={() => setRegisterTouched((p) => ({ ...p, password: true }))}
                        aria-invalid={!!regPassError}
                        aria-describedby={regPassError ? 'reg-pass-error' : undefined}
                        disabled={isSubmitting}
                        className={`w-full pl-9 pr-9 h-10 bg-white border rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                          regPassError
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/20'
                            : 'border-slate-200 focus:border-blue-600 focus:ring-blue-600/20'
                        }`}
                      />
                      <button
                        type="button"
                        tabIndex={0}
                        onClick={() => setShowRegisterPassword((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
                        aria-label={showRegisterPassword ? 'Hide password' : 'Show password'}
                      >
                        {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {regPassError && (
                      <p id="reg-pass-error" role="alert" className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{regPassError}</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="reg-confirm-password" className="block text-xs font-semibold text-slate-800">
                      Confirm Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reg-confirm-password"
                        name="confirmPassword"
                        type={showRegisterConfirmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Re-enter password"
                        value={registerConfirmPassword}
                        onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                        onBlur={() => setRegisterTouched((p) => ({ ...p, confirmPassword: true }))}
                        aria-invalid={!!regConfirmPassError}
                        aria-describedby={regConfirmPassError ? 'reg-confirm-pass-error' : undefined}
                        disabled={isSubmitting}
                        className={`w-full pl-9 pr-9 h-10 bg-white border rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                          regConfirmPassError
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/20'
                            : 'border-slate-200 focus:border-blue-600 focus:ring-blue-600/20'
                        }`}
                      />
                      <button
                        type="button"
                        tabIndex={0}
                        onClick={() => setShowRegisterConfirmPassword((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
                        aria-label={showRegisterConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showRegisterConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {regConfirmPassError && (
                      <p id="reg-confirm-pass-error" role="alert" className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{regConfirmPassError}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Starter Plan Summary */}
              <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">
                      {activePlan.name} Included
                    </p>
                    <p className="text-[11px] text-slate-500">
                      ₹0/mo · {activePlan.printerLimit || 1} Printer · Unlimited QR Orders
                    </p>
                  </div>
                </div>
                <Chip variant="success" size="sm" dot>
                  Included
                </Chip>
              </div>

              {/* Terms Checkbox */}
              <div className="pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600 select-none">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => {
                      setAgreeTerms(e.target.checked);
                      setRegisterTouched((p) => ({ ...p, terms: true }));
                    }}
                    disabled={isSubmitting}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 mt-0.5 cursor-pointer"
                  />
                  <span className="leading-relaxed">
                    I agree to the PrintFlow Terms of Service and Merchant Privacy Policy.
                  </span>
                </label>
                {regTermsError && (
                  <p role="alert" className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{regTermsError}</span>
                  </p>
                )}
              </div>

              {/* Register Submit Button */}
              <Button
                type="submit"
                variant="solid"
                size="lg"
                disabled={isSubmitting}
                className="w-full mt-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Shop Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* ========================================================= */}
          {/* 3. FORGOT PASSWORD VIEW                                   */}
          {/* ========================================================= */}
          {view === 'forgot' && (
            <div className="space-y-4">
              {forgotSuccess ? (
                <div className="text-center py-4 space-y-3.5">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Reset Link Sent</h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                      If an account exists for this email address, you will receive a password reset link shortly. Please check your inbox and spam folder.
                    </p>
                  </div>

                  <Button
                    variant="solid"
                    size="md"
                    onClick={() => {
                      setForgotSuccess(false);
                      setView('login');
                    }}
                    className="w-full mt-2"
                  >
                    <span>Proceed to Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgot} noValidate className="space-y-4">
                  {/* Email */}
                  <div className="space-y-1.5">
                    <label htmlFor="forgot-email" className="block text-xs font-semibold text-slate-800">
                      Registered Email Address <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="forgot-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="shop@printflow.io"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        onBlur={() => setForgotTouched((p) => ({ ...p, email: true }))}
                        aria-invalid={!!forgotEmailError}
                        aria-describedby={forgotEmailError ? 'forgot-email-error' : undefined}
                        disabled={isSubmitting}
                        className={`w-full pl-9 pr-3.5 h-10 sm:h-11 bg-white border rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                          forgotEmailError
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/20'
                            : 'border-slate-200 focus:border-blue-600 focus:ring-blue-600/20'
                        }`}
                      />
                    </div>
                    {forgotEmailError && (
                      <p id="forgot-email-error" role="alert" className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{forgotEmailError}</span>
                      </p>
                    )}
                  </div>

                  {/* Send Reset Link Submit Button */}
                  <Button
                    type="submit"
                    variant="solid"
                    size="lg"
                    disabled={isSubmitting}
                    className="w-full mt-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending Reset Link...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Reset Link</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* 4. RESET PASSWORD VIEW (VIA EMAIL VERIFICATION LINK)      */}
          {/* ========================================================= */}
          {view === 'reset-password' && (
            <div className="space-y-4">
              {forgotSuccess ? (
                <div className="text-center py-4 space-y-3.5">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Password Reset Complete</h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                      Your password has been reset successfully. You can now sign in with your new password.
                    </p>
                  </div>
                  <Button
                    variant="solid"
                    size="md"
                    onClick={() => {
                      setForgotSuccess(false);
                      setView('login');
                    }}
                    className="w-full mt-2"
                  >
                    <span>Proceed to Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              ) : !resetTokenParam ? (
                <div className="text-center py-4 space-y-3.5">
                  <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Invalid or Missing Link</h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                      Invalid or missing password reset link. Please request a new password reset link.
                    </p>
                  </div>
                  <Button
                    variant="solid"
                    size="md"
                    onClick={() => setView('forgot')}
                    className="w-full mt-2"
                  >
                    <span>Request Reset Link</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} noValidate className="space-y-4">
                  {/* New Password */}
                  <div className="space-y-1.5">
                    <label htmlFor="new-password" className="block text-xs font-semibold text-slate-800">
                      New Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="new-password"
                        name="newPassword"
                        type={showNewPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Min 6 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        onBlur={() => setForgotTouched((p) => ({ ...p, newPassword: true }))}
                        aria-invalid={!!forgotPassError}
                        aria-describedby={forgotPassError ? 'forgot-pass-error' : undefined}
                        disabled={isSubmitting}
                        className={`w-full pl-9 pr-10 h-10 sm:h-11 bg-white border rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                          forgotPassError
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/20'
                            : 'border-slate-200 focus:border-blue-600 focus:ring-blue-600/20'
                        }`}
                      />
                      <button
                        type="button"
                        tabIndex={0}
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
                        aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {forgotPassError && (
                      <p id="forgot-pass-error" role="alert" className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{forgotPassError}</span>
                      </p>
                    )}
                  </div>

                  {/* Confirm New Password */}
                  <div className="space-y-1.5">
                    <label htmlFor="confirm-new-password" className="block text-xs font-semibold text-slate-800">
                      Confirm New Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="confirm-new-password"
                        name="confirmNewPassword"
                        type={showConfirmNewPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Re-enter new password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        onBlur={() => setForgotTouched((p) => ({ ...p, confirmPassword: true }))}
                        aria-invalid={!!forgotConfirmError}
                        aria-describedby={forgotConfirmError ? 'forgot-confirm-error' : undefined}
                        disabled={isSubmitting}
                        className={`w-full pl-9 pr-10 h-10 sm:h-11 bg-white border rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                          forgotConfirmError
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/20'
                            : 'border-slate-200 focus:border-blue-600 focus:ring-blue-600/20'
                        }`}
                      />
                      <button
                        type="button"
                        tabIndex={0}
                        onClick={() => setShowConfirmNewPassword((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
                        aria-label={showConfirmNewPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {forgotConfirmError && (
                      <p id="forgot-confirm-error" role="alert" className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{forgotConfirmError}</span>
                      </p>
                    )}
                  </div>

                  {/* Reset Password Submit Button */}
                  <Button
                    type="submit"
                    variant="solid"
                    size="lg"
                    disabled={isSubmitting}
                    className="w-full mt-1"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Resetting Password...</span>
                      </>
                    ) : (
                      <>
                        <span>Reset Password</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* Switcher Navigation Links */}
          <div className="pt-3 text-center text-xs text-slate-500 border-t border-slate-100">
            {view === 'login' ? (
              <p>
                Don't have a shop account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setView('register');
                  }}
                  className="font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                >
                  Register Your Shop
                </button>
              </p>
            ) : view === 'register' ? (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setView('login');
                  }}
                  className="font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                >
                  Sign In
                </button>
              </p>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setView('login');
                }}
                className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
            )}
          </div>
        </div>

        {/* Platform Security Footer */}
        <div className="text-center space-y-1 text-slate-400 text-xs pt-1">
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>256-bit TLS Encrypted · Multi-tenant Session Isolation</span>
          </div>
          <p className="text-[11px] text-slate-400">PrintFlow Cloud · Modern Xerox & Copy Center Operations</p>
        </div>
      </div>
    </div>
  );
};
