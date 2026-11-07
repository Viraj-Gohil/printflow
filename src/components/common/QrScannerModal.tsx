import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  QrCode,
  Camera,
  AlertCircle,
  RotateCw,
  CheckCircle2,
  ArrowRight,
  Flashlight,
  SwitchCamera,
  Keyboard,
  Store
} from 'lucide-react';
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

  const [cameraState, setCameraState] = useState<'requesting' | 'active' | 'denied' | 'unsupported'>('requesting');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>('');
  const [useManual, setUseManual] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState<number>(0);
  const [scannedSuccess, setScannedSuccess] = useState<string | null>(null);

  // Stop camera tracks helper
  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
  };

  // Enumerate video devices (to show switch button if multiple cameras exist)
  useEffect(() => {
    if (!isOpen) return;
    navigator.mediaDevices?.enumerateDevices?.().then((devices) => {
      const videoDevs = devices.filter((d) => d.kind === 'videoinput');
      setCameras(videoDevs);
    }).catch(() => {});
  }, [isOpen]);

  // Main Camera Initialization
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCameraState('requesting');
      setCameraError(null);
      setVerifyError(null);
      setIsVerifying(false);
      setManualInput('');
      setUseManual(false);
      setTorchOn(false);
      setScannedSuccess(null);
      return;
    }

    if (useManual) {
      stopCamera();
      return;
    }

    let isSubscribed = true;

    async function initCamera() {
      try {
        setCameraState('requesting');
        setCameraError(null);

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera access is not supported by your browser or requires a secure (HTTPS) connection.');
        }

        stopCamera();

        // Specific deviceId or ideal facingMode
        const selectedDevice = cameras[currentCameraIndex]?.deviceId;
        const constraints: MediaStreamConstraints = {
          video: selectedDevice
            ? { deviceId: { exact: selectedDevice } }
            : {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 }
              },
          audio: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        if (!isSubscribed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        // Check if torch/flashlight is supported
        const track = stream.getVideoTracks()[0];
        if (track && typeof (track.getCapabilities as any) === 'function') {
          const caps = (track.getCapabilities as any)();
          setHasTorch(Boolean(caps?.torch));
        } else {
          setHasTorch(false);
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.setAttribute('autoplay', 'true');
          videoRef.current.setAttribute('muted', 'true');

          await videoRef.current.play().catch(() => {});
          setCameraState('active');
          animationFrameRef.current = requestAnimationFrame(scanLoop);
        }
      } catch (err: any) {
        if (!isSubscribed) return;
        console.warn('[QrScanner] Camera start error:', err);

        let errorText = 'Could not access device camera. Please enter the shop code manually.';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraState('denied');
          errorText = 'Camera permission was denied. Please allow camera access in your browser address bar settings to scan the QR code.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setCameraState('unsupported');
          errorText = 'No camera found on this device. You can enter the counter shop code manually.';
        } else {
          setCameraState('unsupported');
          errorText = err?.message || errorText;
        }

        setCameraError(errorText);
      }
    }

    initCamera();

    return () => {
      isSubscribed = false;
      stopCamera();
    };
  }, [isOpen, useManual, currentCameraIndex]);

  // Scanning loop using jsQR
  const scanLoop = () => {
    if (!videoRef.current || !canvasRef.current || !streamRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code && code.data && code.data.trim()) {
          // Found QR Code!
          handleScannedData(code.data.trim());
          return; // Stop animation loop
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanLoop);
  };

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && typeof (track.applyConstraints as any) === 'function') {
      try {
        const nextTorch = !torchOn;
        await (track.applyConstraints as any)({
          advanced: [{ torch: nextTorch }]
        });
        setTorchOn(nextTorch);
      } catch (e) {
        console.warn('Torch toggle failed:', e);
      }
    }
  };

  // Switch between available cameras
  const switchCamera = () => {
    if (cameras.length <= 1) return;
    setCurrentCameraIndex((prev) => (prev + 1) % cameras.length);
  };

  // Extract shop slug from raw string
  const extractShopSlug = (raw: string): string => {
    let clean = raw.trim();

    // 1. Check if contains URL with /s/
    const sMatch = clean.match(/(?:^|[/#])s\/([a-zA-Z0-9_-]+)/i);
    if (sMatch && sMatch[1]) {
      return sMatch[1];
    }

    // 2. Custom URI schemes: easytoprint://shop/:slug or printflow://shop/:slug
    const schemeMatch = clean.match(/(?:easytoprint|printflow):\/\/(?:shop\/)?([a-zA-Z0-9_-]+)/i);
    if (schemeMatch && schemeMatch[1]) {
      return schemeMatch[1];
    }

    // 3. JSON payload
    if (clean.startsWith('{') && clean.endsWith('}')) {
      try {
        const parsed = JSON.parse(clean);
        if (parsed.slug) return String(parsed.slug);
        if (parsed.shopSlug) return String(parsed.shopSlug);
        if (parsed.shopId) return String(parsed.shopId);
      } catch {}
    }

    // 4. If user passed a full URL, parse pathname
    try {
      const url = new URL(clean);
      const parts = url.pathname.split('/').filter(Boolean);
      const sIdx = parts.indexOf('s');
      if (sIdx !== -1 && parts[sIdx + 1]) {
        return parts[sIdx + 1];
      }
      if (parts.length > 0) {
        return parts[parts.length - 1];
      }
    } catch {}

    // 5. Direct clean slug
    return clean.replace(/[^a-zA-Z0-9_-]/g, '');
  };

  // Verify and Route
  const handleScannedData = async (rawPayload: string) => {
    if (isVerifying) return;
    setIsVerifying(true);
    setVerifyError(null);
    stopCamera();

    // Haptic feedback
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(100);
      } catch {}
    }

    const candidateSlug = extractShopSlug(rawPayload);

    if (!candidateSlug || candidateSlug.length < 2) {
      setVerifyError('Invalid QR code. Please scan an official EasyToPrint counter QR code.');
      setIsVerifying(false);
      return;
    }

    try {
      // Check backend verify endpoint
      const res = await fetch(apiUrl('/api/public/verify-qr'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrPayload: rawPayload })
      });
      const data = await res.json();

      if (data.success && data.shop?.slug) {
        setScannedSuccess(data.shop.name || candidateSlug);
        setTimeout(() => {
          onSuccess(data.shop.slug);
          onClose();
        }, 600);
      } else {
        // Fallback: If verify-qr returns specific error or shop not recognized
        // Check if shop capabilities are available directly for candidateSlug
        const capRes = await fetch(apiUrl(`/api/shops/${encodeURIComponent(candidateSlug)}/capabilities`)).catch(() => null);
        if (capRes && capRes.ok) {
          const capData = await capRes.json();
          if (capData.success) {
            setScannedSuccess(capData.shop?.name || candidateSlug);
            setTimeout(() => {
              onSuccess(candidateSlug);
              onClose();
            }, 600);
            return;
          }
        }

        setVerifyError(data.error || `Shop "${candidateSlug}" was not recognized. Please scan a valid EasyToPrint counter standee.`);
        setIsVerifying(false);
      }
    } catch (err) {
      console.error('[QrScanner] Verification failed:', err);
      // If network fails, allow candidate slug directly if plausible
      if (candidateSlug.length >= 3) {
        onSuccess(candidateSlug);
        onClose();
      } else {
        setVerifyError('Network error checking shop status. Please check your internet connection.');
        setIsVerifying(false);
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleScannedData(manualInput.trim());
  };

  const handleRestartScanner = () => {
    setVerifyError(null);
    setIsVerifying(false);
    setScannedSuccess(null);
    setUseManual(false);
    setCameraState('requesting');
    setCameraError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 font-['Manrope',sans-serif]">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-[#050505]/75 backdrop-blur-sm"
        onClick={() => {
          stopCamera();
          onClose();
        }}
      />

      {/* Modal Dialog Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-[#E1E7E1] z-10 flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-white border-b border-[#E1E7E1] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#E8F8EC] text-[#00A61C] flex items-center justify-center shrink-0 border border-[#A7F3D0]">
              <QrCode className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-semibold text-[#111111] leading-tight truncate">
                Scan Shop QR Code
              </h3>
              <p className="text-[11px] text-[#646B65] leading-tight truncate">
                Point camera at the EasyToPrint counter standee
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-[#F7F8F7] hover:bg-[#E1E7E1] text-[#646B65] hover:text-[#111111] flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Close Scanner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Success State */}
          {scannedSuccess ? (
            <div className="py-10 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-[#E8F8EC] text-[#00A61C] border border-[#A7F3D0] flex items-center justify-center mx-auto shadow-2xs">
                <CheckCircle2 className="w-8 h-8 stroke-[2.2]" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-[#111111]">Shop Verified!</h4>
                <p className="text-xs text-[#00A61C] font-medium mt-0.5">Connecting to {scannedSuccess}...</p>
              </div>
              <p className="text-[11px] text-[#646B65]">Redirecting to document upload page...</p>
            </div>
          ) : isVerifying ? (
            /* Verifying State */
            <div className="py-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-full border-3 border-[#00A61C] border-t-transparent animate-spin mx-auto" />
              <div>
                <h4 className="text-sm font-semibold text-[#111111]">Verifying Shop QR...</h4>
                <p className="text-xs text-[#646B65] mt-1">Connecting to EasyToPrint verification server</p>
              </div>
            </div>
          ) : useManual || cameraState === 'denied' || cameraState === 'unsupported' ? (
            /* Manual Entry View or Permission Denied View */
            <div className="space-y-4">
              {cameraError && (
                <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200/80 flex items-start gap-3 text-xs text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-amber-950">
                      {cameraState === 'denied' ? 'Camera Permission Required' : 'Camera Unavailable'}
                    </p>
                    <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                      {cameraError}
                    </p>
                  </div>
                </div>
              )}

              <form onSubmit={handleManualSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#111111]">
                    Enter Shop Name, Slug, or Counter URL
                  </label>
                  <p className="text-[11px] text-[#646B65]">
                    Type the name printed below the counter QR code (e.g. <span className="font-mono text-[#00A61C]">printflow-counter</span>)
                  </p>
                </div>

                <div className="relative">
                  <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#646B65] pointer-events-none" />
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="e.g. printflow-counter"
                    className="w-full h-11 pl-10 pr-4 bg-[#F7F8F7] hover:bg-[#F0F2F0] focus:bg-white border border-[#E1E7E1] rounded-xl text-xs sm:text-sm font-mono text-[#111111] placeholder:text-[#646B65] focus:outline-none focus:ring-2 focus:ring-[#00A61C] focus:border-transparent transition-all"
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={!manualInput.trim()}
                  className="w-full h-11 bg-[#00A61C] hover:bg-[#008F25] disabled:opacity-50 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Open Shop Upload Page</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {cameraState !== 'unsupported' && (
                <button
                  type="button"
                  onClick={handleRestartScanner}
                  className="w-full py-2.5 bg-[#F7F8F7] hover:bg-[#E1E7E1] text-[#111111] rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Camera className="w-3.5 h-3.5 text-[#00A61C]" />
                  <span>Try Camera Scanner Again</span>
                </button>
              )}
            </div>
          ) : (
            /* Live Camera Viewfinder */
            <div className="space-y-3">
              <div className="relative aspect-square sm:aspect-[4/3] bg-black rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  playsInline
                  autoPlay
                  muted
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Reticle / Viewfinder Frame */}
                <div className="absolute inset-8 sm:inset-10 pointer-events-none flex items-center justify-center">
                  {/* Top-Left Corner */}
                  <div className="absolute top-0 left-0 w-7 h-7 border-t-3 border-l-3 border-[#00A61C] rounded-tl-lg" />
                  {/* Top-Right Corner */}
                  <div className="absolute top-0 right-0 w-7 h-7 border-t-3 border-r-3 border-[#00A61C] rounded-tr-lg" />
                  {/* Bottom-Left Corner */}
                  <div className="absolute bottom-0 left-0 w-7 h-7 border-b-3 border-l-3 border-[#00A61C] rounded-bl-lg" />
                  {/* Bottom-Right Corner */}
                  <div className="absolute bottom-0 right-0 w-7 h-7 border-b-3 border-r-3 border-[#00A61C] rounded-br-lg" />

                  {/* Animated Green Laser Scan Line */}
                  <div className="w-full h-0.5 bg-[#00A61C] shadow-[0_0_12px_#00A61C] animate-pulse" />
                </div>

                {/* Camera Control Overlays (Torch & Switch) */}
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  {hasTorch && (
                    <button
                      type="button"
                      onClick={toggleTorch}
                      className={`p-2 rounded-full backdrop-blur-md transition-colors cursor-pointer ${
                        torchOn ? 'bg-[#00A61C] text-white' : 'bg-black/50 text-white hover:bg-black/70'
                      }`}
                      title={torchOn ? 'Turn off light' : 'Turn on light'}
                    >
                      <Flashlight className="w-4 h-4" />
                    </button>
                  )}
                  {cameras.length > 1 && (
                    <button
                      type="button"
                      onClick={switchCamera}
                      className="p-2 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md text-white transition-colors cursor-pointer"
                      title="Switch camera"
                    >
                      <SwitchCamera className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Viewfinder Instructions Banner */}
                <div className="absolute bottom-3 left-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl text-center text-[11px] text-white font-medium">
                  Center the EasyToPrint counter QR code
                </div>
              </div>

              {/* Alternative Manual Entry Trigger */}
              <button
                type="button"
                onClick={() => setUseManual(true)}
                className="w-full py-2.5 bg-[#F7F8F7] hover:bg-[#E1E7E1] text-[#111111] rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Keyboard className="w-3.5 h-3.5 text-[#646B65]" />
                <span>Or enter shop code manually</span>
              </button>
            </div>
          )}

          {/* Verification Error Notice */}
          {verifyError && (
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-rose-900">QR Code Error</p>
                <p className="text-[11px] text-rose-700 mt-0.5 leading-relaxed">{verifyError}</p>
                <button
                  type="button"
                  onClick={handleRestartScanner}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#00A61C] hover:underline cursor-pointer"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Scan again</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-[#F7F8F7] border-t border-[#E1E7E1] text-center text-[11px] text-[#646B65]">
          EasyToPrint Counter Self-Service · No App Required
        </div>
      </motion.div>
    </div>
  );
};
