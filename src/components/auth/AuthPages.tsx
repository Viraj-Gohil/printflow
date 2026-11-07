import React, { useState, useEffect } from 'react';
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
  validateCity,
  evaluatePasswordStrength
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
  const [view, setView] = useState<'login' | 'register' | 'forgot' | 'verify-reset-otp' | 'reset-password' | 'reset-success' | 'verify-email'>(effectiveInitialView);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginTouched, setLoginTouched] = useState<{ email?: boolean; password?: boolean }>({});

  // Register form state
  const [registerShopName, setRegisterShopName] = useState('');
  const [registerCity, setRegisterCity] = useState('');
  const [registerShopAddress, setRegisterShopAddress] = useState('');
  const [registerOwnerName, setRegisterOwnerName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [registerTouched, setRegisterTouched] = useState<Record<string, boolean>>({});
  const [emailExistsError, setEmailExistsError] = useState<string | null>(null);
  const [phoneExistsError, setPhoneExistsError] = useState<string | null>(null);

  // Password Reset OTP & Flow State
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [maskedContact, setMaskedContact] = useState('');
  const [resetOtpCode, setResetOtpCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newResetPassword, setNewResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [showNewResetPassword, setShowNewResetPassword] = useState(false);
  const [showConfirmResetPassword, setShowConfirmResetPassword] = useState(false);
  const [resetResendCountdown, setResetResendCountdown] = useState(60);
  const [resetCanResend, setResetCanResend] = useState(false);
  const [devResetOtpHint, setDevResetOtpHint] = useState<string | null>(null);

  useEffect(() => {
    if (view === 'verify-reset-otp' && resetResendCountdown > 0) {
      const timer = setTimeout(() => setResetResendCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    } else if (resetResendCountdown === 0) {
      setResetCanResend(true);
    }
  }, [view, resetResendCountdown]);

  // Global submission status & safe error message
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Email verification state
  const [verificationEmail, setVerificationEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resendCountdown, setResendCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  useEffect(() => {
    if (view === 'verify-email' && resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    } else if (resendCountdown === 0) {
      setCanResend(true);
    }
  }, [view, resendCountdown]);

  const maskEmail = (email: string) => {
    if (!email || !email.includes('@')) return email;
    const [name, domain] = email.split('@');
    if (name.length <= 2) return `${name[0]}***@${domain}`;
    return `${name.slice(0, 2)}***@${domain}`;
  };

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
  const regCityError = registerTouched.city ? validateCity(registerCity).error : undefined;
  const regAddressError = registerTouched.shopAddress && !registerShopAddress.trim() ? 'Complete shop address is required.' : undefined;
  const regOwnerError = registerTouched.ownerName ? validateOwnerName(registerOwnerName).error : undefined;
  const regEmailError = registerTouched.email ? validateEmail(registerEmail).error : undefined;
  const regPhoneError = registerTouched.phone ? validatePhone(registerPhone, true).error : undefined;
  const regPassError = registerTouched.password ? validatePassword(registerPassword, 'Password').error : undefined;
  const regTermsError = registerTouched.terms && !agreeTerms ? 'You must accept the terms to proceed.' : undefined;



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

  const passwordStrength = evaluatePasswordStrength(registerPassword);

  const checkAvailability = async (emailVal: string, phoneVal: string) => {
    if (!emailVal && !phoneVal) return;
    try {
      const res = await fetch('/api/auth/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailVal, phone: phoneVal })
      });
      const data = await res.json();
      if (data?.success) {
        if (data.emailExists) {
          setEmailExistsError('This email address is already registered. Please use another email or log in.');
        } else {
          setEmailExistsError(null);
        }
        if (data.phoneExists) {
          setPhoneExistsError('This mobile number is already registered. Please use another number.');
        } else {
          setPhoneExistsError(null);
        }
      }
    } catch {}
  };

  // Handle Register Submission
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);

    // Touch all fields for error display
    setRegisterTouched({
      shopName: true,
      city: true,
      shopAddress: true,
      ownerName: true,
      email: true,
      phone: true,
      password: true,
      terms: true
    });

    const shopCheck = validateShopName(registerShopName);
    if (!shopCheck.isValid) {
      setErrorMessage(shopCheck.error || 'Invalid shop name.');
      return;
    }

    const cityCheck = validateCity(registerCity);
    if (!cityCheck.isValid) {
      setErrorMessage(cityCheck.error || 'Invalid city.');
      return;
    }

    if (!registerShopAddress.trim()) {
      setErrorMessage('Please enter your complete shop address.');
      return;
    }

    const ownerCheck = validateOwnerName(registerOwnerName);
    if (!ownerCheck.isValid) {
      setErrorMessage(ownerCheck.error || 'Invalid owner name.');
      return;
    }

    const emailCheck = validateEmail(registerEmail);
    if (!emailCheck.isValid) {
      setErrorMessage(emailCheck.error || 'Invalid email.');
      return;
    }

    if (emailExistsError) {
      setErrorMessage(emailExistsError);
      return;
    }

    const phoneCheck = validatePhone(registerPhone, true);
    if (!phoneCheck.isValid) {
      setErrorMessage(phoneCheck.error || 'Invalid mobile number.');
      return;
    }

    if (phoneExistsError) {
      setErrorMessage(phoneExistsError);
      return;
    }

    if (passwordStrength.score !== 3) {
      setErrorMessage(passwordStrength.error || 'Password must be strong and meet all security requirements.');
      return;
    }

    if (!agreeTerms) {
      setErrorMessage('Please agree to the service terms to create your account.');
      return;
    }

    // Race-safe backend availability re-check before submission
    setIsSubmitting(true);
    try {
      const resAvail = await fetch('/api/auth/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registerEmail, phone: registerPhone })
      });
      const dataAvail = await resAvail.json();
      if (dataAvail?.success) {
        if (dataAvail.emailExists) {
          const errText = 'This email address is already registered. Please use another email or log in.';
          setEmailExistsError(errText);
          setErrorMessage(errText);
          setIsSubmitting(false);
          return;
        }
        if (dataAvail.phoneExists) {
          const errText = 'This mobile number is already registered. Please use another number.';
          setPhoneExistsError(errText);
          setErrorMessage(errText);
          setIsSubmitting(false);
          return;
        }
      }
    } catch {}

    try {
      const res = await registerShop({
        shopName: registerShopName.trim(),
        ownerName: registerOwnerName.trim(),
        email: registerEmail.trim(),
        phone: registerPhone.trim(),
        city: registerCity.trim(),
        password: registerPassword,
        planId: 'plan_starter'
      });
      setIsSubmitting(false);
      if (!res.success) {
        setErrorMessage(res.message || 'Registration failed. Please check your details and try again.');
      } else if (res.requireEmailVerification) {
        setVerificationEmail(res.email || registerEmail.trim());
        if (res.devOtp) setDevOtpHint(res.devOtp);
        setResendCountdown(60);
        setCanResend(false);
        setView('verify-email');
      }
    } catch {
      setIsSubmitting(false);
      setErrorMessage('Registration request failed. Please check your network connection.');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || otpCode.length !== 6) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/verify-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail, otp: otpCode })
      });
      const data = await res.json();
      setIsSubmitting(false);
      if (data.success) {
        if (data.accessToken) {
          localStorage.setItem('printflow_access_token', data.accessToken);
        }
        window.location.href = '/shop/dashboard';
      } else {
        setErrorMessage(data.error || 'Invalid or expired OTP. Please try again.');
      }
    } catch {
      setIsSubmitting(false);
      setErrorMessage('Network error while verifying OTP.');
    }
  };

  const handleResendOtp = async () => {
    if (!canResend || isSubmitting) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/resend-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail })
      });
      const data = await res.json();
      setIsSubmitting(false);
      if (data.success) {
        if (data.devOtp) setDevOtpHint(data.devOtp);
        setResendCountdown(60);
        setCanResend(false);
      } else {
        setErrorMessage(data.error || 'Failed to resend OTP.');
      }
    } catch {
      setIsSubmitting(false);
      setErrorMessage('Network error while resending OTP.');
    }
  };

  // Handle Forgot Password Request (Step 1)
  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !forgotIdentifier.trim()) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: forgotIdentifier.trim() })
      });
      const data = await res.json();
      setIsSubmitting(false);
      if (data.success) {
        setMaskedContact(data.maskedContact || forgotIdentifier.trim());
        if (data.devOtp) setDevResetOtpHint(data.devOtp);
        setResetResendCountdown(60);
        setResetCanResend(false);
        setView('verify-reset-otp');
      } else {
        setErrorMessage(data.error || 'Failed to process request.');
      }
    } catch {
      setIsSubmitting(false);
      setErrorMessage('Network error while requesting password reset.');
    }
  };

  // Handle Verify Reset OTP (Step 2)
  const handleVerifyResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || resetOtpCode.length !== 6) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/verify-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: forgotIdentifier.trim(), otp: resetOtpCode })
      });
      const data = await res.json();
      setIsSubmitting(false);
      if (data.success && data.resetToken) {
        setResetToken(data.resetToken);
        setView('reset-password');
      } else {
        setErrorMessage(data.error || 'Invalid or expired verification code.');
      }
    } catch {
      setIsSubmitting(false);
      setErrorMessage('Network error while verifying OTP.');
    }
  };

  // Handle Resend Reset OTP
  const handleResendResetOtp = async () => {
    if (!resetCanResend || isSubmitting) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/resend-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: forgotIdentifier.trim() })
      });
      const data = await res.json();
      setIsSubmitting(false);
      if (data.success) {
        if (data.devOtp) setDevResetOtpHint(data.devOtp);
        setResetResendCountdown(60);
        setResetCanResend(false);
      } else {
        setErrorMessage(data.error || 'Failed to resend verification code.');
      }
    } catch {
      setIsSubmitting(false);
      setErrorMessage('Network error while resending verification code.');
    }
  };

  const resetPasswordStrength = evaluatePasswordStrength(newResetPassword);

  // Handle Reset Password Submit (Step 3)
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);

    if (resetPasswordStrength.score !== 3) {
      setErrorMessage(resetPasswordStrength.error || 'Password must be strong and meet all security requirements.');
      return;
    }

    if (newResetPassword !== confirmResetPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (!resetToken) {
      setErrorMessage('Missing password reset authorization. Please restart the forgot password process.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword: newResetPassword })
      });
      const data = await res.json();
      setIsSubmitting(false);
      if (data.success) {
        setView('reset-success');
      } else {
        setErrorMessage(data.error || 'Failed to reset password.');
      }
    } catch {
      setIsSubmitting(false);
      setErrorMessage('Network error while resetting password.');
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#F7F8F7] relative overflow-hidden font-['Manrope',sans-serif]">
      {/* Subtle background grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.35]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #E1E7E1 1px, transparent 1px),
            linear-gradient(to bottom, #E1E7E1 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px'
        }}
      />
      {/* Soft green ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#00B32D]/10 rounded-full blur-3xl pointer-events-none" />

      <div className={`w-full relative z-10 space-y-6 ${view === 'register' ? 'max-w-[540px]' : 'max-w-[460px]'}`}>
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#00B32D] text-white flex items-center justify-center mx-auto shadow-md shadow-emerald-500/20">
            <Printer className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <span className="text-[11px] font-mono uppercase tracking-widest font-bold text-[#008F25]">
              PRINTFLOW SHOP CONSOLE
            </span>
            <h1 className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-[#111111] mt-1">
              {view === 'login'
                ? 'Sign in to Shop Console'
                : view === 'register'
                ? 'Register Your Shop'
                : 'Reset Your Password'}
            </h1>
            <p className="text-xs sm:text-sm text-[#646B65] mt-1.5 max-w-sm mx-auto leading-relaxed">
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
          {/* VERIFY EMAIL OTP VIEW                                     */}
          {/* ========================================================= */}
          {view === 'verify-email' && (
            <form onSubmit={handleVerifyOtp} noValidate className="space-y-4">
              <div className="text-center space-y-2 pb-2">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#00B32D] flex items-center justify-center mx-auto">
                  <Mail className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#111111]">Verify Your Email Address</h3>
                <p className="text-xs text-[#646B65] max-w-xs mx-auto">
                  We've sent a 6-digit verification code to <strong className="text-[#111111]">{maskEmail(verificationEmail)}</strong>. Enter the code below to activate your shop.
                </p>

              </div>

              <div className="space-y-1.5 text-left">
                <label htmlFor="otp-input" className="block text-xs font-bold text-[#111111]">
                  Enter 6-Digit OTP Code
                </label>
                <input
                  id="otp-input"
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  disabled={isSubmitting}
                  className="w-full h-12 text-center text-xl font-mono tracking-widest bg-[#F7F8F7] border border-[#E1E7E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00B32D] focus:bg-white transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || otpCode.length !== 6}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#00B32D] hover:bg-[#008F25] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying OTP...</span>
                  </>
                ) : (
                  <>
                    <span>Verify &amp; Activate Shop</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                  </>
                )}
              </button>

              <div className="pt-3 text-center text-xs text-[#646B65]">
                {canResend ? (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className="font-bold text-[#00B32D] hover:underline cursor-pointer"
                  >
                    Resend Verification OTP
                  </button>
                ) : (
                  <p>Resend OTP in <span className="font-bold text-[#111111]">{resendCountdown}s</span></p>
                )}
              </div>
            </form>
          )}

          {/* ========================================================= */}
          {/* 1. SIGN IN VIEW                                           */}
          {/* ========================================================= */}
          {view === 'login' && (
            <form onSubmit={handleLogin} noValidate className="space-y-4">
              {/* Email Address */}
              <div className="space-y-1.5 text-left">
                <label htmlFor="login-email" className="block text-xs font-bold text-[#111111]">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#646B65] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="Enter your email"
                    value={loginEmail}
                    onChange={(e) => {
                      setLoginEmail(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    onBlur={() => setLoginTouched((prev) => ({ ...prev, email: true }))}
                    aria-invalid={!!loginEmailError}
                    aria-describedby={loginEmailError ? 'login-email-error' : undefined}
                    disabled={isSubmitting}
                    className={`w-full pl-10 pr-4 h-11 bg-[#F7F8F7] border rounded-xl text-xs sm:text-sm text-[#111111] placeholder:text-[#646B65] focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                      loginEmailError
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/20'
                        : 'border-[#E1E7E1] focus:border-[#00B32D] focus:ring-[#00B32D]/20'
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
              <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <label htmlFor="login-password" className="text-xs font-bold text-[#111111]">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setView('forgot');
                    }}
                    className="text-xs font-bold text-[#00B32D] hover:text-[#008F25] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#646B65] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                    className={`w-full pl-10 pr-10 h-11 bg-[#F7F8F7] border rounded-xl text-xs sm:text-sm text-[#111111] placeholder:text-[#646B65] focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                      loginPasswordError
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/20'
                        : 'border-[#E1E7E1] focus:border-[#00B32D] focus:ring-[#00B32D]/20'
                    }`}
                  />
                  <button
                    type="button"
                    tabIndex={0}
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#646B65] hover:text-[#111111] focus:outline-none p-1 rounded-md transition-colors"
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
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#00B32D] hover:bg-[#008F25] text-white text-sm font-bold shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Shop</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ========================================================= */}
          {/* 2. SHOP REGISTRATION VIEW                                 */}
          {/* ========================================================= */}
          {view === 'register' && (
            <form onSubmit={handleRegister} noValidate className="space-y-4">
              {/* Group 1: Business Details */}
              <div className="space-y-3">
                <span className="text-[11px] uppercase font-mono tracking-wider font-semibold text-[#008F25] block border-b border-[#E1E7E1] pb-1">
                  1. Shop Business Details
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5 text-left">
                    <label htmlFor="reg-shop-name" className="block text-xs font-bold text-[#111111]">
                      Shop / Business Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Store className="w-4 h-4 text-[#646B65] absolute left-3 top-3 pointer-events-none" />
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
                        className={`w-full pl-9 pr-3 h-10 bg-[#F7F8F7] border rounded-xl text-xs sm:text-sm text-[#111111] placeholder:text-[#646B65] focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                          regShopError
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/20'
                            : 'border-[#E1E7E1] focus:border-[#00B32D] focus:ring-[#00B32D]/20'
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

                  <div className="space-y-1.5 text-left">
                    <label htmlFor="reg-city" className="block text-xs font-bold text-[#111111]">
                      City <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-[#646B65] absolute left-3 top-3 pointer-events-none" />
                      <input
                        id="reg-city"
                        name="city"
                        type="text"
                        placeholder="e.g. Ahmedabad"
                        value={registerCity}
                        onChange={(e) => setRegisterCity(e.target.value)}
                        onBlur={() => setRegisterTouched((p) => ({ ...p, city: true }))}
                        aria-invalid={!!regCityError}
                        aria-describedby={regCityError ? 'reg-city-error' : undefined}
                        disabled={isSubmitting}
                        className={`w-full pl-9 pr-3 h-10 bg-[#F7F8F7] border rounded-xl text-xs sm:text-sm text-[#111111] placeholder:text-[#646B65] focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                          regCityError
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/20'
                            : 'border-[#E1E7E1] focus:border-[#00B32D] focus:ring-[#00B32D]/20'
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

                <div className="space-y-1.5 text-left">
                  <label htmlFor="reg-shop-address" className="block text-xs font-bold text-[#111111]">
                    Full Shop Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-[#646B65] absolute left-3 top-3 pointer-events-none" />
                    <textarea
                      id="reg-shop-address"
                      name="shopAddress"
                      rows={2}
                      placeholder="Enter your complete shop address"
                      value={registerShopAddress}
                      onChange={(e) => setRegisterShopAddress(e.target.value)}
                      onBlur={() => setRegisterTouched((p) => ({ ...p, shopAddress: true }))}
                      aria-invalid={!!regAddressError}
                      aria-describedby={regAddressError ? 'reg-address-error' : undefined}
                      disabled={isSubmitting}
                      className={`w-full pl-9 pr-3 py-2 bg-[#F7F8F7] border rounded-xl text-xs sm:text-sm text-[#111111] placeholder:text-[#646B65] focus:outline-none focus:ring-2 focus:bg-white transition-all resize-none ${
                        regAddressError
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/20'
                          : 'border-[#E1E7E1] focus:border-[#00B32D] focus:ring-[#00B32D]/20'
                      }`}
                    />
                  </div>
                  {regAddressError && (
                    <p id="reg-address-error" role="alert" className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{regAddressError}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Group 2: Owner & Contact */}
              <div className="space-y-3">
                <span className="text-[11px] uppercase font-mono tracking-wider font-semibold text-[#008F25] block border-b border-[#E1E7E1] pb-1">
                  2. Owner & Contact Information
                </span>

                <div className="space-y-1.5 text-left">
                  <label htmlFor="reg-owner-name" className="block text-xs font-bold text-[#111111]">
                    Owner Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#646B65] absolute left-3 top-3 pointer-events-none" />
                    <input
                      id="reg-owner-name"
                      name="ownerName"
                      type="text"
                      autoComplete="name"
                      placeholder="Enter your full name"
                      value={registerOwnerName}
                      onChange={(e) => setRegisterOwnerName(e.target.value)}
                      onBlur={() => setRegisterTouched((p) => ({ ...p, ownerName: true }))}
                      aria-invalid={!!regOwnerError}
                      aria-describedby={regOwnerError ? 'reg-owner-error' : undefined}
                      disabled={isSubmitting}
                      className={`w-full pl-9 pr-3 h-10 bg-[#F7F8F7] border rounded-xl text-xs sm:text-sm text-[#111111] placeholder:text-[#646B65] focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                        regOwnerError
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/20'
                          : 'border-[#E1E7E1] focus:border-[#00B32D] focus:ring-[#00B32D]/20'
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
                  <div className="space-y-1.5 text-left">
                    <label htmlFor="reg-email" className="block text-xs font-bold text-[#111111]">
                      Business Email Address <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#646B65] absolute left-3 top-3 pointer-events-none" />
                      <input
                        id="reg-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="shop@example.com"
                        value={registerEmail}
                        onChange={(e) => {
                          setRegisterEmail(e.target.value);
                          if (emailExistsError) setEmailExistsError(null);
                        }}
                        onBlur={() => {
                          setRegisterTouched((p) => ({ ...p, email: true }));
                          checkAvailability(registerEmail, registerPhone);
                        }}
                        aria-invalid={!!regEmailError || !!emailExistsError}
                        aria-describedby={regEmailError || emailExistsError ? 'reg-email-error' : undefined}
                        disabled={isSubmitting}
                        className={`w-full pl-9 pr-3 h-10 bg-[#F7F8F7] border rounded-xl text-xs sm:text-sm text-[#111111] placeholder:text-[#646B65] focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                          regEmailError || emailExistsError
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/20'
                            : 'border-[#E1E7E1] focus:border-[#00B32D] focus:ring-[#00B32D]/20'
                        }`}
                      />
                    </div>
                    {regEmailError && (
                      <p id="reg-email-error" role="alert" className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{regEmailError}</span>
                      </p>
                    )}
                    {emailExistsError && !regEmailError && (
                      <p role="alert" className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{emailExistsError}</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5 text-left">
                    <label htmlFor="reg-phone" className="block text-xs font-bold text-[#111111]">
                      Mobile Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-[#646B65] absolute left-3 top-3 pointer-events-none" />
                      <input
                        id="reg-phone"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        maxLength={10}
                        placeholder="9876543210"
                        value={registerPhone}
                        onChange={(e) => {
                          setRegisterPhone(e.target.value.replace(/\D/g, ''));
                          if (phoneExistsError) setPhoneExistsError(null);
                        }}
                        onBlur={() => {
                          setRegisterTouched((p) => ({ ...p, phone: true }));
                          checkAvailability(registerEmail, registerPhone);
                        }}
                        aria-invalid={!!regPhoneError || !!phoneExistsError}
                        aria-describedby={regPhoneError || phoneExistsError ? 'reg-phone-error' : undefined}
                        disabled={isSubmitting}
                        className={`w-full pl-9 pr-3 h-10 bg-[#F7F8F7] border rounded-xl text-xs sm:text-sm font-mono text-[#111111] placeholder:text-[#646B65] focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                          regPhoneError || phoneExistsError
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/20'
                            : 'border-[#E1E7E1] focus:border-[#00B32D] focus:ring-[#00B32D]/20'
                        }`}
                      />
                    </div>
                    {regPhoneError && (
                      <p id="reg-phone-error" role="alert" className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{regPhoneError}</span>
                      </p>
                    )}
                    {phoneExistsError && !regPhoneError && (
                      <p role="alert" className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{phoneExistsError}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Group 3: Account Credentials */}
              <div className="space-y-3">
                <span className="text-[11px] uppercase font-mono tracking-wider font-semibold text-[#008F25] block border-b border-[#E1E7E1] pb-1">
                  3. Account Credentials
                </span>

                <div className="space-y-1.5 text-left">
                  <label htmlFor="reg-password" className="block text-xs font-bold text-[#111111]">
                    Create Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#646B65] absolute left-3 top-3 pointer-events-none" />
                    <input
                      id="reg-password"
                      name="password"
                      type={showRegisterPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Min 12 chars (Upper, lower, number, special)"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      onBlur={() => setRegisterTouched((p) => ({ ...p, password: true }))}
                      aria-invalid={!!regPassError}
                      aria-describedby={regPassError ? 'reg-pass-error' : undefined}
                      disabled={isSubmitting}
                      className={`w-full pl-9 pr-10 h-10 bg-[#F7F8F7] border rounded-xl text-xs sm:text-sm text-[#111111] placeholder:text-[#646B65] focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                        regPassError
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/20'
                          : 'border-[#E1E7E1] focus:border-[#00B32D] focus:ring-[#00B32D]/20'
                      }`}
                    />
                    <button
                      type="button"
                      tabIndex={0}
                      onClick={() => setShowRegisterPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#646B65] hover:text-[#111111] p-1 rounded-md transition-colors"
                      aria-label={showRegisterPassword ? 'Hide password' : 'Show password'}
                    >
                      {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Live Password Strength Indicator (3 horizontal segments) */}
                  {registerPassword.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="grid grid-cols-3 gap-1.5 h-1.5">
                        <div className={`rounded-full transition-all duration-300 ${passwordStrength.score >= 1 ? (passwordStrength.score === 1 ? 'bg-red-500' : passwordStrength.score === 2 ? 'bg-amber-500' : 'bg-[#00B32D]') : 'bg-[#E1E7E1]'}`} />
                        <div className={`rounded-full transition-all duration-300 ${passwordStrength.score >= 2 ? (passwordStrength.score === 2 ? 'bg-amber-500' : 'bg-[#00B32D]') : 'bg-[#E1E7E1]'}`} />
                        <div className={`rounded-full transition-all duration-300 ${passwordStrength.score === 3 ? 'bg-[#00B32D]' : 'bg-[#E1E7E1]'}`} />
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className={`font-bold uppercase tracking-wider ${passwordStrength.score === 1 ? 'text-red-600' : passwordStrength.score === 2 ? 'text-amber-600' : 'text-[#00B32D]'}`}>
                          {passwordStrength.strength}
                        </span>
                        <span className={passwordStrength.score === 3 ? 'text-[#008F25] font-medium' : 'text-[#646B65]'}>
                          {passwordStrength.score === 3 ? 'Strong password. Your password meets the security requirements.' : 'Use at least 12 characters with uppercase, lowercase, numbers and special characters.'}
                        </span>
                      </div>
                    </div>
                  )}

                  {regPassError && (
                    <p id="reg-pass-error" role="alert" className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{regPassError}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="pt-1 text-left">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#646B65] select-none">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => {
                      setAgreeTerms(e.target.checked);
                      setRegisterTouched((p) => ({ ...p, terms: true }));
                    }}
                    disabled={isSubmitting}
                    className="w-4 h-4 rounded text-[#00B32D] border-[#E1E7E1] focus:ring-[#00B32D] mt-0.5 cursor-pointer"
                  />
                  <span className="leading-relaxed">
                    I agree to the Terms & Conditions and Privacy Policy.
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
              {(() => {
                const isFormValid =
                  registerShopName.trim().length >= 3 &&
                  registerCity.trim().length >= 2 &&
                  registerShopAddress.trim().length >= 5 &&
                  registerOwnerName.trim().length >= 2 &&
                  validateEmail(registerEmail).isValid &&
                  !emailExistsError &&
                  validatePhone(registerPhone, true).isValid &&
                  !phoneExistsError &&
                  passwordStrength.score === 3 &&
                  agreeTerms;

                return (
                  <button
                    type="submit"
                    disabled={!isFormValid || isSubmitting}
                    className="w-full mt-2 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#00B32D] hover:bg-[#008F25] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creating Account...</span>
                      </>
                    ) : (
                      <>
                        <span>Create Shop Account</span>
                        <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                      </>
                    )}
                  </button>
                );
              })()}
            </form>
          )}

          {/* ========================================================= */}
          {/* FORGOT PASSWORD VIEW (STEP 1)                             */}
          {/* ========================================================= */}
          {view === 'forgot' && (
            <form onSubmit={handleForgotRequest} noValidate className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label htmlFor="forgot-identifier" className="block text-xs font-bold text-[#111111]">
                  Registered Email or Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#646B65] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="forgot-identifier"
                    type="text"
                    placeholder="e.g. shop@example.com or 9876543210"
                    value={forgotIdentifier}
                    onChange={(e) => {
                      setForgotIdentifier(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    disabled={isSubmitting}
                    className="w-full pl-10 pr-4 h-11 bg-[#F7F8F7] border border-[#E1E7E1] rounded-xl text-xs sm:text-sm text-[#111111] placeholder:text-[#646B65] focus:outline-none focus:ring-2 focus:ring-[#00B32D] focus:bg-white transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !forgotIdentifier.trim()}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#00B32D] hover:bg-[#008F25] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ========================================================= */}
          {/* VERIFY RESET OTP VIEW (STEP 2)                            */}
          {/* ========================================================= */}
          {view === 'verify-reset-otp' && (
            <form onSubmit={handleVerifyResetOtp} noValidate className="space-y-4">
              <div className="text-center space-y-2 pb-2">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#00B32D] flex items-center justify-center mx-auto">
                  <Shield className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#111111]">Verify Your Identity</h3>
                <p className="text-xs text-[#646B65] max-w-xs mx-auto">
                  Enter the 6-digit verification code sent to <strong className="text-[#111111]">{maskedContact}</strong>.
                </p>

              </div>

              <div className="space-y-1.5 text-left">
                <label htmlFor="reset-otp-input" className="block text-xs font-bold text-[#111111]">
                  Enter 6-Digit OTP Code
                </label>
                <input
                  id="reset-otp-input"
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={resetOtpCode}
                  onChange={(e) => setResetOtpCode(e.target.value.replace(/\D/g, ''))}
                  disabled={isSubmitting}
                  className="w-full h-12 text-center text-xl font-mono tracking-widest bg-[#F7F8F7] border border-[#E1E7E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00B32D] focus:bg-white transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || resetOtpCode.length !== 6}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#00B32D] hover:bg-[#008F25] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying OTP...</span>
                  </>
                ) : (
                  <>
                    <span>Verify OTP</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                  </>
                )}
              </button>

              <div className="pt-3 text-center text-xs text-[#646B65] space-y-2">
                <div>
                  {resetCanResend ? (
                    <button
                      type="button"
                      onClick={handleResendResetOtp}
                      className="font-bold text-[#00B32D] hover:underline cursor-pointer"
                    >
                      Resend Verification OTP
                    </button>
                  ) : (
                    <p>Resend OTP in <span className="font-bold text-[#111111]">{resetResendCountdown}s</span></p>
                  )}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setView('forgot')}
                    className="text-[#646B65] hover:text-[#111111] underline cursor-pointer"
                  >
                    Change Email / Mobile
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ========================================================= */}
          {/* RESET PASSWORD VIEW (STEP 3)                              */}
          {/* ========================================================= */}
          {view === 'reset-password' && (
            <form onSubmit={handleResetPasswordSubmit} noValidate className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label htmlFor="new-reset-password" className="block text-xs font-bold text-[#111111]">
                  New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#646B65] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="new-reset-password"
                    type={showNewResetPassword ? 'text' : 'password'}
                    placeholder="Min 12 chars (Upper, lower, number, special)"
                    value={newResetPassword}
                    onChange={(e) => setNewResetPassword(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full pl-10 pr-10 h-11 bg-[#F7F8F7] border border-[#E1E7E1] rounded-xl text-xs sm:text-sm text-[#111111] placeholder:text-[#646B65] focus:outline-none focus:ring-2 focus:ring-[#00B32D] focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewResetPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#646B65] hover:text-[#111111] p-1 rounded-md transition-colors"
                  >
                    {showNewResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Live Password Strength Indicator (3 horizontal segments) */}
                {newResetPassword.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="grid grid-cols-3 gap-1.5 h-1.5">
                      <div className={`rounded-full transition-all duration-300 ${resetPasswordStrength.score >= 1 ? (resetPasswordStrength.score === 1 ? 'bg-red-500' : resetPasswordStrength.score === 2 ? 'bg-amber-500' : 'bg-[#00B32D]') : 'bg-[#E1E7E1]'}`} />
                      <div className={`rounded-full transition-all duration-300 ${resetPasswordStrength.score >= 2 ? (resetPasswordStrength.score === 2 ? 'bg-amber-500' : 'bg-[#00B32D]') : 'bg-[#E1E7E1]'}`} />
                      <div className={`rounded-full transition-all duration-300 ${resetPasswordStrength.score === 3 ? 'bg-[#00B32D]' : 'bg-[#E1E7E1]'}`} />
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={`font-bold uppercase tracking-wider ${resetPasswordStrength.score === 1 ? 'text-red-600' : resetPasswordStrength.score === 2 ? 'text-amber-600' : 'text-[#00B32D]'}`}>
                        {resetPasswordStrength.strength}
                      </span>
                      <span className={resetPasswordStrength.score === 3 ? 'text-[#008F25] font-medium' : 'text-[#646B65]'}>
                        {resetPasswordStrength.score === 3 ? 'Strong password.' : 'At least 12 chars with upper, lower, number & special char.'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 text-left">
                <label htmlFor="confirm-reset-password" className="block text-xs font-bold text-[#111111]">
                  Confirm New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#646B65] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="confirm-reset-password"
                    type={showConfirmResetPassword ? 'text' : 'password'}
                    placeholder="Re-enter new password"
                    value={confirmResetPassword}
                    onChange={(e) => setConfirmResetPassword(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full pl-10 pr-10 h-11 bg-[#F7F8F7] border border-[#E1E7E1] rounded-xl text-xs sm:text-sm text-[#111111] placeholder:text-[#646B65] focus:outline-none focus:ring-2 focus:ring-[#00B32D] focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmResetPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#646B65] hover:text-[#111111] p-1 rounded-md transition-colors"
                  >
                    {showConfirmResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || resetPasswordStrength.score !== 3 || newResetPassword !== confirmResetPassword}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#00B32D] hover:bg-[#008F25] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Resetting Password...</span>
                  </>
                ) : (
                  <>
                    <span>Reset Password</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ========================================================= */}
          {/* PASSWORD RESET SUCCESS VIEW (STEP 4)                      */}
          {/* ========================================================= */}
          {view === 'reset-success' && (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#00B32D] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-[#111111]">Password Reset Successful!</h3>
                <p className="text-xs sm:text-sm text-[#646B65] max-w-xs mx-auto leading-relaxed">
                  Your password has been updated successfully. You can now sign in using your new password.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setForgotIdentifier('');
                  setResetOtpCode('');
                  setResetToken('');
                  setNewResetPassword('');
                  setConfirmResetPassword('');
                  setView('login');
                }}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#00B32D] hover:bg-[#008F25] text-white text-sm font-bold shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
              >
                <span>Back to Login</span>
                <ArrowRight className="w-4 h-4 stroke-[2.2]" />
              </button>
            </div>
          )}

          {/* Switcher Navigation Links */}
          <div className="pt-4 text-center text-xs text-[#646B65] border-t border-[#E1E7E1]">
            {view === 'login' ? (
              <p>
                Don't have a shop account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setView('register');
                  }}
                  className="font-bold text-[#00B32D] hover:text-[#008F25] hover:underline cursor-pointer"
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
                  className="font-bold text-[#00B32D] hover:text-[#008F25] hover:underline cursor-pointer"
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
                className="inline-flex items-center gap-1 font-bold text-[#00B32D] hover:text-[#008F25] hover:underline cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Login</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
