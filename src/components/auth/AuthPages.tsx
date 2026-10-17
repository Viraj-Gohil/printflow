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
  Crown,
  Sparkles,
  Cpu
} from 'lucide-react';
import {
  validateEmail,
  validatePhone,
  validatePassword,
  validateShopName,
  validateOwnerName,
  validateCity
} from '../../lib/validation';

interface AuthPagesProps {
  initialView?: 'login' | 'register' | 'forgot';
}

export const AuthPages: React.FC<AuthPagesProps> = ({ initialView = 'login' }) => {
  const { login, registerShop, forgotPassword, navigate, currentUser, plans } = useApp();
  const [view, setView] = useState<'login' | 'register' | 'forgot'>(initialView);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginTouched, setLoginTouched] = useState<{ email?: boolean; password?: boolean }>({});

  // Register form state
  const [registerShopName, setRegisterShopName] = useState('');
  const [registerOwnerName, setRegisterOwnerName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerCity, setRegisterCity] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('plan_free');
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [registerTouched, setRegisterTouched] = useState<Record<string, boolean>>({});

  // Forgot password form state
  const [forgotEmail, setForgotEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotTouched, setForgotTouched] = useState<Record<string, boolean>>({});
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // Global submission status
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already logged in, offer quick dashboard jump
  if (currentUser?.role === 'SHOP_OWNER') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 bg-[#f8fafc]">
        <div className="max-w-md w-full bg-white p-7 rounded-3xl border border-slate-200 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Signed In to Counter</h2>
          <p className="text-xs text-slate-500">
            You are logged in as <strong>{currentUser.fullName}</strong>.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => navigate('/shop/dashboard')}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Go to Shop Console
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Back to Home
            </button>
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
    ? newPassword !== confirmNewPassword
      ? 'Passwords do not match.'
      : undefined
    : undefined;

  // Handle Login Submission
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
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
    setTimeout(() => {
      const res = login(loginEmail, loginPassword);
      setIsSubmitting(false);
      if (!res.success) {
        setErrorMessage(res.message || 'Invalid email or password.');
      }
    }, 400);
  };

  // Handle Register Submission
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
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
    setTimeout(() => {
      const res = registerShop({
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
        setErrorMessage(res.message || 'Registration failed.');
      }
    }, 400);
  };

  // Handle Forgot Password Submission
  const handleForgot = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    setForgotTouched({ email: true, newPassword: true, confirmPassword: true });

    const emailCheck = validateEmail(forgotEmail);
    if (!emailCheck.isValid) {
      setErrorMessage(emailCheck.error || 'Invalid email.');
      return;
    }

    const passCheck = validatePassword(newPassword, 'New Password');
    if (!passCheck.isValid) {
      setErrorMessage(passCheck.error || 'Invalid password.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const res = forgotPassword(forgotEmail, newPassword);
      setIsSubmitting(false);
      if (res.success) {
        setForgotSuccess(true);
      } else {
        setErrorMessage(res.message || 'No registered account found with this email.');
      }
    }, 400);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#f8fafc]">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-13 h-13 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-sm">
            <Printer className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {view === 'login'
              ? 'Sign in to Shop Console'
              : view === 'register'
              ? 'Register Your Xerox Shop'
              : 'Reset Your Password'}
          </h1>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            {view === 'login'
              ? 'Manage your counter queue, print jobs, and rates.'
              : view === 'register'
              ? 'Start cloud QR ordering for your counter in 2 minutes.'
              : 'Enter your registered email to reset your credentials.'}
          </p>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Card Form Container */}
        <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
          {/* 1. LOGIN VIEW */}
          {view === 'login' && (
            <form onSubmit={handleLogin} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">Email Address</label>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="e.g. shop@printflow.io"
                    value={loginEmail}
                    onChange={(e) => {
                      setLoginEmail(e.target.value);
                      if (loginTouched.email) setLoginTouched((prev) => ({ ...prev, email: true }));
                    }}
                    onBlur={() => setLoginTouched((prev) => ({ ...prev, email: true }))}
                    className={`w-full pl-9 pr-3.5 h-11 bg-slate-50 border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                      loginEmailError
                        ? 'border-red-400 focus:ring-red-400 bg-red-50/20'
                        : 'border-slate-200 focus:ring-blue-600'
                    }`}
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                </div>
                {loginEmailError && (
                  <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{loginEmailError}</span>
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setView('forgot');
                    }}
                    className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Enter your password"
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      if (loginTouched.password) setLoginTouched((prev) => ({ ...prev, password: true }));
                    }}
                    onBlur={() => setLoginTouched((prev) => ({ ...prev, password: true }))}
                    className={`w-full pl-9 pr-3.5 h-11 bg-slate-50 border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:bg-white transition-all font-mono ${
                      loginPasswordError
                        ? 'border-red-400 focus:ring-red-400 bg-red-50/20'
                        : 'border-slate-200 focus:ring-blue-600'
                    }`}
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                </div>
                {loginPasswordError && (
                  <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{loginPasswordError}</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <span>{isSubmitting ? 'Signing In...' : 'Sign In to Shop'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Demo Credentials Helper */}
              <div className="pt-2">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Demo Credentials
                    </span>
                    <span className="text-[10px] font-medium text-slate-500">1-Click Quick Fill</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setLoginEmail('vikram.royalcyber@gmail.com');
                        setLoginPassword('shop');
                        setErrorMessage(null);
                      }}
                      className="text-left p-2 rounded-lg bg-white border border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 transition-all text-xs cursor-pointer group"
                    >
                      <div className="font-semibold text-slate-800 group-hover:text-purple-700">Royal Cyber Xerox</div>
                      <div className="text-[11px] text-slate-500 font-mono truncate">vikram.royalcyber@gmail.com</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Password: <span className="font-mono text-slate-600 font-semibold">shop</span></div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLoginEmail('sunita.campusprints@gmail.com');
                        setLoginPassword('shop');
                        setErrorMessage(null);
                      }}
                      className="text-left p-2 rounded-lg bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all text-xs cursor-pointer group"
                    >
                      <div className="font-semibold text-slate-800 group-hover:text-blue-700">Campus Fast Prints</div>
                      <div className="text-[11px] text-slate-500 font-mono truncate">sunita.campusprints@gmail.com</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Password: <span className="font-mono text-slate-600 font-semibold">shop</span></div>
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* 2. REGISTER VIEW WITH STRICT INLINE VALIDATION */}
          {view === 'register' && (
            <form onSubmit={handleRegister} noValidate className="space-y-3.5">
              {/* Shop Business Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">
                  Shop Business Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. City Xerox & Graphics"
                    value={registerShopName}
                    onChange={(e) => setRegisterShopName(e.target.value)}
                    onBlur={() => setRegisterTouched((p) => ({ ...p, shopName: true }))}
                    className={`w-full pl-9 pr-3.5 h-10 bg-slate-50 border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                      regShopError ? 'border-red-400 focus:ring-red-400 bg-red-50/20' : 'border-slate-200 focus:ring-blue-600'
                    }`}
                  />
                  <Store className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
                {regShopError && (
                  <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{regShopError}</span>
                  </p>
                )}
              </div>

              {/* Owner Name & City */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">
                    Owner Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Your full name"
                      value={registerOwnerName}
                      onChange={(e) => setRegisterOwnerName(e.target.value)}
                      onBlur={() => setRegisterTouched((p) => ({ ...p, ownerName: true }))}
                      className={`w-full pl-8 pr-2.5 h-10 bg-slate-50 border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                        regOwnerError ? 'border-red-400 focus:ring-red-400 bg-red-50/20' : 'border-slate-200 focus:ring-blue-600'
                      }`}
                    />
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                  </div>
                  {regOwnerError && (
                    <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{regOwnerError}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">
                    City / Location <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. Pune, MH"
                      value={registerCity}
                      onChange={(e) => setRegisterCity(e.target.value)}
                      onBlur={() => setRegisterTouched((p) => ({ ...p, city: true }))}
                      className={`w-full pl-8 pr-2.5 h-10 bg-slate-50 border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                        regCityError ? 'border-red-400 focus:ring-red-400 bg-red-50/20' : 'border-slate-200 focus:ring-blue-600'
                      }`}
                    />
                    <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                  </div>
                  {regCityError && (
                    <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{regCityError}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="shop@email.com"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      onBlur={() => setRegisterTouched((p) => ({ ...p, email: true }))}
                      className={`w-full pl-8 pr-2.5 h-10 bg-slate-50 border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                        regEmailError ? 'border-red-400 focus:ring-red-400 bg-red-50/20' : 'border-slate-200 focus:ring-blue-600'
                      }`}
                    />
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                  </div>
                  {regEmailError && (
                    <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{regEmailError}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">
                    Mobile (10 Digits) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="9876543210"
                      value={registerPhone}
                      onChange={(e) => setRegisterPhone(e.target.value.replace(/\D/g, ''))}
                      onBlur={() => setRegisterTouched((p) => ({ ...p, phone: true }))}
                      className={`w-full pl-8 pr-2.5 h-10 bg-slate-50 border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:bg-white transition-all font-mono ${
                        regPhoneError ? 'border-red-400 focus:ring-red-400 bg-red-50/20' : 'border-slate-200 focus:ring-blue-600'
                      }`}
                    />
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                  </div>
                  {regPhoneError && (
                    <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{regPhoneError}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">
                    Create Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="Min 6 characters"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      onBlur={() => setRegisterTouched((p) => ({ ...p, password: true }))}
                      className={`w-full pl-8 pr-2.5 h-10 bg-slate-50 border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:bg-white transition-all font-mono ${
                        regPassError ? 'border-red-400 focus:ring-red-400 bg-red-50/20' : 'border-slate-200 focus:ring-blue-600'
                      }`}
                    />
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                  </div>
                  {regPassError && (
                    <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{regPassError}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="Re-enter password"
                      value={registerConfirmPassword}
                      onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                      onBlur={() => setRegisterTouched((p) => ({ ...p, confirmPassword: true }))}
                      className={`w-full pl-8 pr-2.5 h-10 bg-slate-50 border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:bg-white transition-all font-mono ${
                        regConfirmPassError
                          ? 'border-red-400 focus:ring-red-400 bg-red-50/20'
                          : 'border-slate-200 focus:ring-blue-600'
                      }`}
                    />
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                  </div>
                  {regConfirmPassError && (
                    <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{regConfirmPassError}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="pt-1">
                <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-600 select-none">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => {
                      setAgreeTerms(e.target.checked);
                      setRegisterTouched((p) => ({ ...p, terms: true }));
                    }}
                    className="w-4 h-4 rounded text-blue-600 mt-0.5"
                  />
                  <span>
                    I agree to the PrintFlow Terms of Service and Merchant Privacy Policy.
                  </span>
                </label>
                {regTermsError && (
                  <p className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{regTermsError}</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 mt-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <span>{isSubmitting ? 'Registering Shop...' : 'Create Shop Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* 3. FORGOT PASSWORD VIEW */}
          {view === 'forgot' && (
            <div className="space-y-4">
              {forgotSuccess ? (
                <div className="text-center py-4 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Password Reset Complete</h3>
                  <p className="text-xs text-slate-500">
                    Your password has been updated. You can now sign in with your new credentials.
                  </p>
                  <button
                    onClick={() => {
                      setForgotSuccess(false);
                      setView('login');
                    }}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                  >
                    Proceed to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgot} noValidate className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800">
                      Your Registered Email <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        placeholder="e.g. shop@printflow.io"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        onBlur={() => setForgotTouched((p) => ({ ...p, email: true }))}
                        className={`w-full pl-9 pr-3.5 h-11 bg-slate-50 border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                          forgotEmailError
                            ? 'border-red-400 focus:ring-red-400 bg-red-50/20'
                            : 'border-slate-200 focus:ring-blue-600'
                        }`}
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                    </div>
                    {forgotEmailError && (
                      <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{forgotEmailError}</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800">
                      Set New Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        placeholder="Min 6 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        onBlur={() => setForgotTouched((p) => ({ ...p, newPassword: true }))}
                        className={`w-full pl-9 pr-3.5 h-11 bg-slate-50 border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:bg-white transition-all font-mono ${
                          forgotPassError
                            ? 'border-red-400 focus:ring-red-400 bg-red-50/20'
                            : 'border-slate-200 focus:ring-blue-600'
                        }`}
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                    </div>
                    {forgotPassError && (
                      <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{forgotPassError}</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800">
                      Confirm New Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        placeholder="Re-enter new password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        onBlur={() => setForgotTouched((p) => ({ ...p, confirmPassword: true }))}
                        className={`w-full pl-9 pr-3.5 h-11 bg-slate-50 border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:bg-white transition-all font-mono ${
                          forgotConfirmError
                            ? 'border-red-400 focus:ring-red-400 bg-red-50/20'
                            : 'border-slate-200 focus:ring-blue-600'
                        }`}
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                    </div>
                    {forgotConfirmError && (
                      <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{forgotConfirmError}</span>
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <span>{isSubmitting ? 'Resetting Password...' : 'Reset Password'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Switcher Navigation */}
          <div className="pt-2 text-center text-xs text-slate-500 border-t border-slate-100">
            {view === 'login' ? (
              <p>
                Don't have a shop account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setView('register');
                  }}
                  className="font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Register Shop Here
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
                  className="font-bold text-blue-600 hover:underline cursor-pointer"
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
                className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
            )}
          </div>
        </div>

        {/* Platform Security Footer */}
        <div className="text-center space-y-1 text-slate-400 text-xs">
          <div className="flex items-center justify-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span>256-bit TLS Encrypted · Multi-tenant Session Isolation</span>
          </div>
          <p className="text-[11px]">PrintFlow Cloud · Modern Xerox & Copy Center Operations</p>
        </div>
      </div>
    </div>
  );
};
