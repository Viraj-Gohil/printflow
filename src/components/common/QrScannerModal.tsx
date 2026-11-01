import React, { useState, useEffect, useRef } from 'react';
import { X, QrCode, Camera, AlertCircle, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';
import jsQR from 'jsqr';
import { apiUrl } from '../../lib/apiConfig';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (shopSlug: string) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>('');
  const [useManual, setUseManual] = useState<boolean>(false);

  // Stop camera tracks helper
  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Initialize camera when modal opens
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCameraError(null);
      setVerifyError(null);
      setIsVerifying(false);
      setManualInput('');
      setUseManual(false);
      return;
    }

    if (useManual) {
      stopCamera();
      return;
    }

    let active = true;

    async function startCamera() {
      try {
        setCameraError(null);
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera API (getUserMedia) is not supported in this browser or unsecured context.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play().catch(() => {});
          requestAnimationFrame(scanLoop);
        }
      } catch (err: any) {
        if (!active) return;
        console.warn('Camera initialization error:', err);
        let msg = 'Could not access camera. Please check permissions or use manual entry.';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          msg = 'Camera permission denied. Please allow camera access in browser settings.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          msg = 'No rear or front camera device found on this device.';
        }
        setCameraError(msg);
        setUseManual(true);
      }
    }

    startCamera();

    return () => {
      active = false;
      stopCamera();
    };
  }, [isOpen, useManual]);

  // QR Scan decoding loop
  const scanLoop = () => {
    if (!videoRef.current || !canvasRef.current || !streamRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code && code.data) {
          handleScannedPayload(code.data);
          return; // Stop scanning loop on successful detect
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(scanLoop);
  };

  // Verify scanned payload with backend
  const handleScannedPayload = async (rawPayload: string) => {
    if (isVerifying) return;
    setIsVerifying(true);
    setVerifyError(null);
    stopCamera();

    try {
      const res = await fetch(apiUrl('/api/public/verify-qr'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrPayload: rawPayload })
      });
      const data = await res.json();

      if (data.success && data.shop?.slug) {
        onSuccess(data.shop.slug);
        onClose();
      } else {
        setVerifyError(data.error || 'Invalid or inactive shop QR code.');
        setIsVerifying(false);
      }
    } catch (err) {
      console.error('QR verification network error:', err);
      setVerifyError('Network error connecting to verification server. Please retry.');
      setIsVerifying(false);
    }
  };

  // Submit manual input
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleScannedPayload(manualInput.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Scan Shop QR Code</h3>
              <p className="text-[11px] text-slate-400">Align counter QR inside frame</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {isVerifying ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin mx-auto" />
              <h4 className="text-sm font-bold text-slate-900">Verifying Shop QR...</h4>
              <p className="text-xs text-slate-500">Checking server-side shop authenticity & active status</p>
            </div>
          ) : useManual || cameraError ? (
            <div className="space-y-4">
              {cameraError && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2 text-amber-800 text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Camera Unavailable</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">{cameraError}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleManualSubmit} className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">
                  Enter Shop Code or Paste QR URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="e.g. xyz-print-hub or shop URL"
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                  >
                    <span>Verify</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>

              {cameraError && (
                <button
                  onClick={() => {
                    setCameraError(null);
                    setUseManual(false);
                  }}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Camera Scanner</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Camera Viewfinder Box */}
              <div className="relative aspect-[4/3] bg-slate-950 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  muted
                  playsInline
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Targeting Frame Overlay */}
                <div className="absolute inset-8 border-2 border-dashed border-blue-400/80 rounded-xl pointer-events-none flex items-center justify-center">
                  <div className="w-full h-0.5 bg-blue-500/50 animate-pulse" />
                </div>

                <div className="absolute bottom-3 left-3 right-3 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-center text-[11px] text-white font-medium">
                  Center the tabletop shop QR code
                </div>
              </div>

              <button
                onClick={() => setUseManual(true)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer text-center"
              >
                Or enter shop code manually
              </button>
            </div>
          )}

          {verifyError && (
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Verification Failed</p>
                <p className="text-[11px] text-rose-700 mt-0.5">{verifyError}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-500">
          Secure backend verification · Instant shop routing
        </div>
      </div>
    </div>
  );
};
