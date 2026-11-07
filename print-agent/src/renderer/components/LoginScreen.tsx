import React, { useState, useEffect } from 'react';
import { Printer, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export interface LoginScreenProps {
  onPair: (data: {
    serverUrl: string;
    shopId: string;
    authToken: string;
    deviceName?: string;
  }) => Promise<{ success: boolean; error?: string; shopId?: string; agentId?: string; code?: string; activeDevice?: any }>;
  defaultShopId?: string;
  serverUrl?: string;
  onSuccess?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onPair,
  defaultShopId = '',
  serverUrl = 'https://printflow.devpixel.space',
  onSuccess
}) => {
  const [shopId, setShopId] = useState(defaultShopId);
  const [authToken, setAuthToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStage, setConnectionStage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inlineErrors, setInlineErrors] = useState<{ shopId?: string; authToken?: string }>({});
  const [connectedSuccess, setConnectedSuccess] = useState(false);
  const [connectedShopId, setConnectedShopId] = useState('');

  // Subscribe to real asynchronous connection stages from main process if available
  useEffect(() => {
    if (window.electronAgentAPI?.onPairProgress) {
      const unsub = window.electronAgentAPI.onPairProgress((stage) => {
        setConnectionStage(stage);
      });
      return unsub;
    }
  }, []);

  // Format error message to be clear, user-friendly, and free of technical stack traces
  const formatErrorMessage = (rawError?: string): string => {
    if (!rawError) return 'Failed to connect. Please verify your credentials and try again.';
    const lower = rawError.toLowerCase();

    if (lower.includes('fetch failed') || lower.includes('network') || lower.includes('enotfound') || lower.includes('econnrefused')) {
      return 'Network unavailable. Please check your internet connection and try again.';
    }
    if (lower.includes('502') || lower.includes('503') || lower.includes('504') || lower.includes('temporarily unavailable')) {
      return 'PrintFlow server is temporarily unreachable. Please try again shortly.';
    }
    if (lower.includes('invalid') || lower.includes('unauthorized') || lower.includes('401') || lower.includes('403') || lower.includes('credentials') || lower.includes('token')) {
      return 'Invalid Shop ID or Authentication Token. Please check your shop credentials.';
    }
    if (lower.includes('shop not found') || lower.includes('shop id')) {
      return 'Shop not found. Please verify your Shop ID.';
    }
    if (lower.includes('registration') || lower.includes('device')) {
      return 'Device registration failed. Please try reconnecting.';
    }
    if (lower.includes('session') || lower.includes('handover') || lower.includes('replaced')) {
      return 'Active session handover required. Please verify your token to connect this station.';
    }

    // Strip stack traces or file paths if any
    const firstLine = rawError.split('\n')[0].replace(/at\s+.*/gi, '').trim();
    return firstLine || 'Could not connect to PrintFlow. Please check your credentials and try again.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isConnecting || connectedSuccess) return;

    const trimmedShopId = shopId.trim();
    const trimmedToken = authToken.trim();

    // Field-level validations
    const errors: { shopId?: string; authToken?: string } = {};
    if (!trimmedShopId) {
      errors.shopId = 'Shop ID is required.';
    }
    if (!trimmedToken) {
      errors.authToken = 'Authentication Token is required.';
    }

    if (errors.shopId || errors.authToken) {
      setInlineErrors(errors);
      return;
    }

    setInlineErrors({});
    setErrorMessage(null);
    setIsConnecting(true);
    setConnectionStage('Validating credentials...');

    try {
      let effectiveServer = (serverUrl || 'https://printflow.devpixel.space').trim().replace(/\/+$/, '');
      if (!effectiveServer.startsWith('http://') && !effectiveServer.startsWith('https://')) {
        effectiveServer = `https://${effectiveServer}`;
      }

      let detectedDeviceName = 'PrintFlow Counter';
      if (window.electronAgentAPI?.getHostname) {
        try {
          const host = await window.electronAgentAPI.getHostname();
          if (host) detectedDeviceName = host;
        } catch {}
      }

      // Execute pairing through existing secure API
      const result = await onPair({
        serverUrl: effectiveServer,
        shopId: trimmedShopId,
        authToken: trimmedToken,
        deviceName: detectedDeviceName
      });

      if (!result.success) {
        setIsConnecting(false);
        setConnectionStage(null);
        setErrorMessage(formatErrorMessage(result.error));
        // Preserve entered Shop ID; clear token securely
        setAuthToken('');
        return;
      }

      // Successful connection flow
      setConnectedShopId(result.shopId || trimmedShopId);
      setConnectedSuccess(true);
      setIsConnecting(false);
      setConnectionStage(null);

      // Short success transition before automatic navigation to Dashboard
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
      }, 1400);

    } catch (err: any) {
      setIsConnecting(false);
      setConnectionStage(null);
      setErrorMessage(formatErrorMessage(err?.message));
      setAuthToken('');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#F7F8F7] dark:bg-[#0B1120] font-['Manrope',sans-serif] select-none relative overflow-hidden">
      {/* Subtle CSS Grid Background with ~24px grid spacing */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, #E1E7E1 1px, transparent 1px),
            linear-gradient(to bottom, #E1E7E1 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
          opacity: 0.65
        }}
      />

      {/* Centered Login Card */}
      <div className="w-full max-w-[420px] bg-white dark:bg-[#131D33] border border-[#E1E7E1] dark:border-slate-800 rounded-2xl shadow-xl p-8 space-y-6 relative z-10 animate-scale-in">
        
        {/* State A: Success State */}
        {connectedSuccess ? (
          <div className="py-4 text-center space-y-4 animate-fade-in">
            {/* Green Success Icon */}
            <div className="w-16 h-16 rounded-2xl bg-[#E8F8EC] dark:bg-emerald-950/60 border border-[#A7F3D0] dark:border-emerald-800 text-[#00B32D] flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-9 h-9 text-[#00B32D] stroke-[2.2]" />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-[24px] font-bold text-[#111111] dark:text-white tracking-tight">
                Connected Successfully!
              </h1>
              <div className="inline-block px-3 py-1 rounded-lg bg-[#E8F8EC] border border-[#A7F3D0] text-[#008F25] font-mono text-[13px] font-bold mt-1">
                Shop ID: {connectedShopId}
              </div>
              <p className="text-[13px] text-[#646B65] dark:text-slate-400 mt-2">
                Your PC is now connected to your PrintFlow shop.
              </p>
            </div>

            {/* Seamless transition indicator */}
            <div className="pt-3 flex items-center justify-center gap-2 text-xs font-semibold text-[#008F25]">
              <Loader2 className="w-4 h-4 animate-spin text-[#00B32D]" />
              <span>Loading PrintFlow Dashboard...</span>
            </div>
          </div>
        ) : (
          /* State B: Login & Shop Connection Form */
          <>
            {/* Top Branding Section */}
            <div className="text-center space-y-3">
              {/* PrintFlow Agent Logo */}
              <div className="w-14 h-14 rounded-2xl bg-[#E8F8EC] dark:bg-emerald-950/60 border border-[#A7F3D0] dark:border-emerald-800 text-[#00B32D] flex items-center justify-center mx-auto shadow-xs">
                <Printer className="w-7 h-7 stroke-[2.2]" />
              </div>

              <div>
                <h1 className="text-[24px] font-bold text-[#111111] dark:text-white tracking-tight">
                  Connect Your Shop
                </h1>
                <p className="text-[13px] text-[#646B65] dark:text-slate-400 mt-1">
                  Connect your Windows PC with PrintFlow.
                </p>
              </div>
            </div>

            {/* Error Feedback Banner */}
            {errorMessage && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-xs animate-fade-in flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
                <div className="space-y-0.5 flex-1">
                  <p className="font-semibold leading-relaxed">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Field 1: Shop ID */}
              <div className="space-y-1.5">
                <label
                  htmlFor="shop-id-input"
                  className="block text-[13px] font-semibold text-[#111111] dark:text-white"
                >
                  Shop ID
                </label>
                <input
                  id="shop-id-input"
                  type="text"
                  required
                  disabled={isConnecting}
                  value={shopId}
                  onChange={(e) => {
                    setShopId(e.target.value);
                    if (inlineErrors.shopId) {
                      setInlineErrors((prev) => ({ ...prev, shopId: undefined }));
                    }
                  }}
                  placeholder="Enter your Shop ID"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#E1E7E1] dark:border-slate-700 bg-[#FFFFFF] dark:bg-slate-900 text-[#111111] dark:text-white text-[14px] font-mono focus:outline-none focus:border-[#00B32D] focus:ring-2 focus:ring-[#00B32D]/20 transition-all disabled:bg-[#F7F8F7] disabled:text-[#646B65] disabled:cursor-not-allowed"
                />
                {inlineErrors.shopId && (
                  <p role="alert" className="text-[11.5px] text-[#DC2626] font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{inlineErrors.shopId}</span>
                  </p>
                )}
              </div>

              {/* Field 2: Authentication Token */}
              <div className="space-y-1.5">
                <label
                  htmlFor="auth-token-input"
                  className="block text-[13px] font-semibold text-[#111111] dark:text-white"
                >
                  Authentication Token
                </label>
                <div className="relative">
                  <input
                    id="auth-token-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={isConnecting}
                    value={authToken}
                    onChange={(e) => {
                      setAuthToken(e.target.value);
                      if (inlineErrors.authToken) {
                        setInlineErrors((prev) => ({ ...prev, authToken: undefined }));
                      }
                    }}
                    placeholder="Enter your authentication token"
                    className="w-full h-11 pl-3.5 pr-11 rounded-xl border border-[#E1E7E1] dark:border-slate-700 bg-[#FFFFFF] dark:bg-slate-900 text-[#111111] dark:text-white text-[14px] font-mono focus:outline-none focus:border-[#00B32D] focus:ring-2 focus:ring-[#00B32D]/20 transition-all disabled:bg-[#F7F8F7] disabled:text-[#646B65] disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    disabled={isConnecting}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-[#646B65] hover:text-[#111111] dark:hover:text-white cursor-pointer transition-colors"
                    title={showPassword ? 'Hide token' : 'Show token'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {inlineErrors.authToken && (
                  <p role="alert" className="text-[11.5px] text-[#DC2626] font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{inlineErrors.authToken}</span>
                  </p>
                )}
              </div>

              {/* Primary Connect Agent Button */}
              <div className="pt-2 space-y-2.5">
                <button
                  type="submit"
                  disabled={isConnecting}
                  className="w-full h-11 rounded-xl text-[14px] font-bold bg-[#00B32D] hover:bg-[#008F25] active:bg-[#00701D] text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <span>Connect Agent</span>
                  )}
                </button>

                {/* Connection Status Feedback beneath the button */}
                {isConnecting && connectionStage && (
                  <div className="text-center animate-fade-in pt-1">
                    <span className="text-[12px] font-medium text-[#646B65] dark:text-slate-400 flex items-center justify-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00B32D] animate-pulse" />
                      {connectionStage}
                    </span>
                  </div>
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
