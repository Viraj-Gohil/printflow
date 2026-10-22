import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../lib/store';
import QRCode from 'qrcode';
import {
  Download,
  Printer,
  Copy,
  CheckCircle2,
  ExternalLink,
  Share2,
  Smartphone,
  Upload,
  ShieldCheck,
  Sparkles,
  Store,
  Check,
  AlertCircle,
  HelpCircle,
  QrCode,
  Layers,
  ArrowRight,
  Eye,
  Building2,
  Flame,
  FileCheck
} from 'lucide-react';

export const ShopQrCodes: React.FC = () => {
  const { activeShop, showToast, navigate } = useApp();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [copied, setCopied] = useState(false);
  const [qrLoaded, setQrLoaded] = useState(false);
  const [qrError, setQrError] = useState(false);

  // Stand customization controls
  const [format, setFormat] = useState<'A5' | 'A4'>('A5');
  const [orientation, setOrientation] = useState<'PORTRAIT' | 'LANDSCAPE'>('PORTRAIT');
  const [styleMode, setStyleMode] = useState<'STANDARD' | 'MINIMAL' | 'DARK'>('STANDARD');

  // Customer portal URL
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://printflow.in';
  const shopUrl = `${origin}/s/${activeShop.slug || 'shop'}`;

  // Generate QR on canvas whenever shopUrl, orientation, or styleMode changes
  useEffect(() => {
    if (!canvasRef.current || !shopUrl) return;

    setQrError(false);
    const canvas = canvasRef.current;
    const targetWidth = orientation === 'LANDSCAPE' ? 240 : 260;

    const darkColor = styleMode === 'DARK' ? '#0F172A' : styleMode === 'MINIMAL' ? '#1E293B' : '#0F172A';

    QRCode.toCanvas(
      canvas,
      shopUrl,
      {
        width: targetWidth,
        margin: 1,
        color: {
          dark: darkColor,
          light: '#FFFFFF'
        }
      },
      (error) => {
        if (error) {
          console.error('Failed to generate QR code canvas:', error);
          setQrError(true);
        } else {
          setQrLoaded(true);
        }
      }
    );
  }, [shopUrl, orientation, styleMode]);

  // Copy customer URL
  const copyShopUrl = () => {
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(shopUrl);
      } else {
        const input = document.createElement('input');
        input.value = shopUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      showToast('Customer Link Copied', 'Shop ordering link copied to clipboard.', 'success');
      setTimeout(() => setCopied(false), 2200);
    } catch (err) {
      showToast('Copy Failed', 'Please manually select and copy the URL.', 'error');
    }
  };

  // Download high-resolution QR PNG (1400x1400 px, 300 DPI ready)
  const downloadQrCode = () => {
    QRCode.toDataURL(
      shopUrl,
      {
        width: 1400,
        margin: 2,
        color: {
          dark: '#0F172A',
          light: '#FFFFFF'
        }
      },
      (err, url) => {
        if (err || !url) {
          showToast('Download Failed', 'Unable to render high-resolution QR image.', 'error');
          return;
        }
        const link = document.createElement('a');
        link.download = `${activeShop.slug || 'shop'}-tabletop-qr.png`;
        link.href = url;
        link.click();
        showToast('QR Code Downloaded', 'High-resolution QR code image saved to your device.', 'success');
      }
    );
  };

  // Print counter flyer / stand
  const triggerBrowserPrint = () => {
    showToast('Opening Print Dialog', 'Preparing print-ready tabletop stand layout...', 'info');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Share link
  const shareLink = () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator
        .share({
          title: `${activeShop.name} - Instant Xerox Portal`,
          text: `Scan or open this link to upload and print documents at ${activeShop.name}`,
          url: shopUrl
        })
        .catch(() => {
          copyShopUrl();
        });
    } else {
      copyShopUrl();
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* =========================================================================
          1. WORKFLOW STRIP (Makes the 6-step ordering entrance workflow crystal clear)
          SELECT SHOP → GENERATE QR → PREVIEW STAND → PRINT / DOWNLOAD → PLACE AT COUNTER → CUSTOMERS SCAN
         ========================================================================= */}
      <div className="no-print bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Self-Service Counter Workflow
            </h2>
          </div>
          <span className="text-[11px] font-medium text-slate-500">
            "This QR code is your shop's customer ordering entrance."
          </span>
        </div>

        {/* Visual Stepper */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 pt-3.5">
          <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-left">
            <span className="text-[10px] font-mono font-bold text-blue-700 block">STEP 01</span>
            <span className="text-xs font-bold text-slate-900 block mt-0.5">Select Shop</span>
            <span className="text-[10px] text-slate-500 block truncate">{activeShop.name}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-left">
            <span className="text-[10px] font-mono font-bold text-blue-700 block">STEP 02</span>
            <span className="text-xs font-bold text-slate-900 block mt-0.5">Generate QR</span>
            <span className="text-[10px] text-slate-500 block truncate">Auto-linked URL</span>
          </div>

          <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-left">
            <span className="text-[10px] font-mono font-bold text-blue-700 block">STEP 03</span>
            <span className="text-xs font-bold text-slate-900 block mt-0.5">Preview Stand</span>
            <span className="text-[10px] text-slate-500 block truncate">A5 Acrylic Layout</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-left">
            <span className="text-[10px] font-mono font-bold text-slate-600 block">STEP 04</span>
            <span className="text-xs font-bold text-slate-900 block mt-0.5">Download / Print</span>
            <span className="text-[10px] text-slate-500 block truncate">300 DPI / Direct PDF</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-left">
            <span className="text-[10px] font-mono font-bold text-slate-600 block">STEP 05</span>
            <span className="text-xs font-bold text-slate-900 block mt-0.5">Place at Counter</span>
            <span className="text-[10px] text-slate-500 block truncate">Beside Cash Drawer</span>
          </div>

          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-left">
            <span className="text-[10px] font-mono font-bold text-emerald-700 block">STEP 06</span>
            <span className="text-xs font-bold text-slate-900 block mt-0.5">Customer Scans</span>
            <span className="text-[10px] text-emerald-700 font-semibold block truncate">Instant Spooling</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. MAIN WORKSPACE: TWO-COLUMN LAYOUT
          Desktop: Left width approx 40% (lg:col-span-5) / Right width approx 60% (lg:col-span-7)
          Mobile: Stack vertically
         ========================================================================= */}
      <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= LEFT PANEL (~40%) ================= */}
        <div className="lg:col-span-5 space-y-5">
          {/* Card: Your Customer QR */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">Your Customer QR</h2>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                  Entrance Point
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Customers scan this QR code to open your shop's printing portal.
              </p>
            </div>

            {/* Shop Selection & Details */}
            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Shop Name</span>
                <span className="font-bold text-slate-900 truncate max-w-[200px]">
                  {activeShop.name}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                <span className="text-slate-500 font-medium">Architecture</span>
                <span className="text-emerald-700 font-semibold text-[11px] bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-md">
                  1 Shop = 1 Dedicated Account
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Location</span>
                <span className="font-semibold text-slate-700 truncate max-w-[200px]">
                  {activeShop.city || activeShop.address || 'Counter Station 1'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Customer Portal</span>
                <span className="font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Live & Accepting Orders
                </span>
              </div>
            </div>

            {/* Customer URL Input Box */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>Customer URL</span>
                <span className="text-[10px] text-slate-400 font-normal">Selectable link</span>
              </label>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shopUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 select-all cursor-text shadow-2xs"
                />
                <button
                  onClick={copyShopUrl}
                  className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 shadow-2xs"
                  title="Copy customer link"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Link'}</span>
                </button>
              </div>

              <div className="pt-1">
                <a
                  href={`/s/${activeShop.slug || 'shop'}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                  <span>Open Customer View ↗</span>
                </a>
              </div>
            </div>

            {/* QR Actions: Clear Action Area */}
            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  QR Actions
                </span>
                <span className="text-[10px] text-slate-400">Ready to print or deploy</span>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={downloadQrCode}
                  className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
                >
                  <Download className="w-4 h-4" />
                  <span>Download QR</span>
                </button>

                <button
                  onClick={triggerBrowserPrint}
                  className="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print QR Stand</span>
                </button>
              </div>

              <button
                onClick={shareLink}
                className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Share Link with Staff / Customers</span>
              </button>
            </div>
          </div>

          {/* Small Informational Card: YOUR QR CODE */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Your QR Code
                </h3>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                ● Live
              </span>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-2 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Status</span>
                <span className="font-bold text-emerald-700 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Shop</span>
                <span className="font-semibold text-slate-800 truncate max-w-[180px]">
                  {activeShop.name}
                </span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Customer Portal</span>
                <span className="font-semibold text-blue-700">Enabled</span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Last Generated</span>
                <span className="font-mono text-slate-600">Today</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed pt-1 border-t border-slate-100">
              This permanent QR code never expires. Customers can scan directly using any smartphone camera or Google Lens without installing any app.
            </p>
          </div>
        </div>

        {/* ================= RIGHT PANEL (~60%): LIVE STAND PREVIEW ================= */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
             {/* REALISTIC PHYSICAL TABLETOP STAND MOCKUP */}
            <div className="p-4 sm:p-8 bg-slate-100/80 rounded-2xl border border-slate-200/90 flex flex-col items-center justify-center min-h-[490px] overflow-hidden">
              {/* Acrylic Stand Card Frame */}
              <div
                id="printable-qr-stand"
                className={`bg-white rounded-2xl border-2 transition-all duration-300 relative text-center overflow-hidden shadow-xl ${
                  styleMode === 'DARK'
                    ? 'border-slate-800 bg-slate-900 text-white'
                    : 'border-slate-800/90 text-slate-900'
                } ${
                  orientation === 'LANDSCAPE'
                    ? 'w-full max-w-xl p-6 sm:p-8'
                    : format === 'A4'
                    ? 'w-full max-w-sm sm:max-w-md p-6 sm:p-8'
                    : 'w-full max-w-xs sm:max-w-sm p-5 sm:p-7'
                }`}
                style={{
                  background:
                    styleMode === 'DARK'
                      ? 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)'
                      : 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)'
                }}
              >
                {/* Stand Header Accent Bar */}
                <div
                  className={`h-2.5 w-full absolute top-0 left-0 ${
                    styleMode === 'DARK'
                      ? 'bg-linear-to-r from-blue-500 via-indigo-500 to-cyan-400'
                      : styleMode === 'MINIMAL'
                      ? 'bg-slate-900'
                      : 'bg-linear-to-r from-blue-600 via-indigo-600 to-blue-500'
                  }`}
                />

                {orientation === 'LANDSCAPE' ? (
                  /* LANDSCAPE LAYOUT */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-center pt-1">
                    <div className="space-y-3 text-left">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-black text-lg flex items-center justify-center shadow-xs shrink-0">
                          {activeShop.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <h3
                            className={`text-base font-black tracking-tight leading-tight truncate ${
                              styleMode === 'DARK' ? 'text-white' : 'text-slate-900'
                            }`}
                          >
                            {activeShop.name}
                          </h3>
                          <span
                            className={`text-[10px] font-semibold uppercase tracking-wider block truncate ${
                              styleMode === 'DARK' ? 'text-slate-400' : 'text-slate-500'
                            }`}
                          >
                            {activeShop.city || 'Counter Xerox Station'}
                          </span>
                        </div>
                      </div>

                      <div className="pt-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          Self-Service Counter
                        </span>
                        <h4
                          className={`text-2xl font-black tracking-tight mt-1 ${
                            styleMode === 'DARK' ? 'text-white' : 'text-slate-950'
                          }`}
                        >
                          SCAN TO PRINT
                        </h4>
                        <p
                          className={`text-xs mt-1 leading-relaxed ${
                            styleMode === 'DARK' ? 'text-slate-300' : 'text-slate-600'
                          }`}
                        >
                          Scan with your phone camera. Upload documents, select copies & colors, pay online, and collect your prints.
                        </p>
                      </div>

                      <div
                        className={`pt-1 text-[11px] font-bold flex items-center gap-1.5 ${
                          styleMode === 'DARK' ? 'text-emerald-400' : 'text-slate-800'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>No App Required · Instant Spooling</span>
                      </div>
                    </div>

                    {/* QR Column */}
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="p-3 bg-white border-2 border-slate-900 rounded-2xl shadow-sm inline-block">
                        <canvas ref={canvasRef} className="rounded-lg mx-auto" />
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-widest ${
                          styleMode === 'DARK' ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        Point camera or Google Lens
                      </span>
                    </div>
                  </div>
                ) : (
                  /* PORTRAIT LAYOUT (Default A5 / A4) */
                  <div className="space-y-4 pt-1">
                    {/* Shop Identity */}
                    <div className="space-y-1">
                      <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-black text-xl flex items-center justify-center mx-auto shadow-xs">
                        {activeShop.name.charAt(0)}
                      </div>
                      <h3
                        className={`text-lg sm:text-xl font-black tracking-tight ${
                          styleMode === 'DARK' ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        {activeShop.name}
                      </h3>
                      <p
                        className={`text-[11px] font-semibold uppercase tracking-wider ${
                          styleMode === 'DARK' ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        {activeShop.city || activeShop.address || 'Smart Counter Station'}
                      </p>
                    </div>

                    {/* Stand Headline */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 inline-block">
                        Self-Service Counter
                      </span>
                      <h4
                        className={`text-2xl font-black tracking-tight ${
                          styleMode === 'DARK' ? 'text-white' : 'text-slate-950'
                        }`}
                      >
                        SCAN TO PRINT
                      </h4>
                      <p
                        className={`text-xs max-w-xs mx-auto leading-relaxed ${
                          styleMode === 'DARK' ? 'text-slate-300' : 'text-slate-600'
                        }`}
                      >
                        Scan with your phone. Upload documents, select copies & colors, and collect prints instantly.
                      </p>
                    </div>

                    {/* Real Generated QR Box */}
                    <div className="p-3 sm:p-4 bg-white border-2 border-slate-900 rounded-2xl shadow-sm inline-block my-1">
                      {qrError ? (
                        <div className="w-48 h-48 flex flex-col items-center justify-center text-center p-3 text-rose-600">
                          <AlertCircle className="w-8 h-8 mb-2" />
                          <span className="text-xs font-bold">Unable to render QR</span>
                          <button
                            onClick={() => window.location.reload()}
                            className="mt-2 text-[10px] font-bold text-blue-600 underline"
                          >
                            Try Again
                          </button>
                        </div>
                      ) : (
                        <canvas ref={canvasRef} className="rounded-lg mx-auto block max-w-full" />
                      )}
                    </div>

                    {/* Simple Instructions on Stand */}
                    <div className="space-y-2 pt-1">
                      <div
                        className={`grid grid-cols-3 gap-1.5 text-center ${
                          styleMode === 'DARK' ? 'text-slate-200' : 'text-slate-700'
                        }`}
                      >
                        <div
                          className={`p-1.5 rounded-xl border ${
                            styleMode === 'DARK'
                              ? 'bg-slate-800/80 border-slate-700'
                              : 'bg-slate-50 border-slate-100'
                          }`}
                        >
                          <Smartphone className="w-3.5 h-3.5 mx-auto mb-0.5 text-blue-500" />
                          <span className="font-bold text-[10px] block leading-tight">1. Scan</span>
                          <span className="text-[9px] text-slate-400">Phone camera</span>
                        </div>
                        <div
                          className={`p-1.5 rounded-xl border ${
                            styleMode === 'DARK'
                              ? 'bg-slate-800/80 border-slate-700'
                              : 'bg-slate-50 border-slate-100'
                          }`}
                        >
                          <Upload className="w-3.5 h-3.5 mx-auto mb-0.5 text-indigo-400" />
                          <span className="font-bold text-[10px] block leading-tight">2. Upload</span>
                          <span className="text-[9px] text-slate-400">PDF / Photos</span>
                        </div>
                        <div
                          className={`p-1.5 rounded-xl border ${
                            styleMode === 'DARK'
                              ? 'bg-slate-800/80 border-slate-700'
                              : 'bg-slate-50 border-slate-100'
                          }`}
                        >
                          <Printer className="w-3.5 h-3.5 mx-auto mb-0.5 text-emerald-400" />
                          <span className="font-bold text-[10px] block leading-tight">3. Collect</span>
                          <span className="text-[9px] text-slate-400">At counter</span>
                        </div>
                      </div>

                      <div
                        className={`py-1.5 px-3 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 ${
                          styleMode === 'DARK'
                            ? 'bg-slate-800 text-blue-300 border border-slate-700'
                            : 'bg-blue-50 border border-blue-200/80 text-blue-900'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>No App Required · Pay Online Securely</span>
                      </div>
                    </div>

                    {/* Bottom Micro Brand */}
                    <div className="text-[9px] text-slate-400 font-mono pt-1">
                      Instant Counter Token · Powered by PrintFlow Cloud
                    </div>
                  </div>
                )}
              </div>

              {/* Realistic Tabletop Acrylic Base Shadow / Stand Foot */}
              <div className="w-48 sm:w-64 h-3 bg-slate-300/80 rounded-full blur-[2px] mt-2 opacity-80" />
            </div>

            {/* PREVIEW CONTROLS (Format / Orientation / Design Style) */}
            <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Format Control */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Format
                </span>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setFormat('A5')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      format === 'A5'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    A5 (Desk Stand)
                  </button>
                  <button
                    onClick={() => setFormat('A4')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      format === 'A4'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    A4 (Full Sheet)
                  </button>
                </div>
              </div>

              {/* Orientation Control */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Orientation
                </span>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setOrientation('PORTRAIT')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      orientation === 'PORTRAIT'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Portrait
                  </button>
                  <button
                    onClick={() => setOrientation('LANDSCAPE')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      orientation === 'LANDSCAPE'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Landscape
                  </button>
                </div>
              </div>

              {/* Design Style Control */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Design Theme
                </span>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setStyleMode('STANDARD')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      styleMode === 'STANDARD'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Classic
                  </button>
                  <button
                    onClick={() => setStyleMode('MINIMAL')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      styleMode === 'MINIMAL'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Minimal
                  </button>
                  <button
                    onClick={() => setStyleMode('DARK')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      styleMode === 'DARK'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Dark
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. WHERE SHOULD YOU PLACE YOUR QR? (Placement Guide)
         ========================================================================= */}
      <div className="no-print bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            Where Should You Place Your QR Stand?
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Optimize your shop layout so walk-in customers can immediately start ordering without waiting.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/60 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <Store className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-900">1. Billing Counter Desk</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Place right beside your cash drawer or billing monitor where customers queue up to place orders.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/60 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-900">2. Storefront Glass / Waiting Area</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Ideal for visible storefront placement so walk-in customers can upload and pay before stepping inside.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/60 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <Printer className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-900">3. Xerox Machine Station</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Self-service station directly next to the printer output tray for immediate document pickup.
            </p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          4. COUNTER STAND PRINTING GUIDELINES & BEST PRACTICES
         ========================================================================= */}
      <div className="no-print bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-slate-900">
            Counter Stand Printing & Material Guide
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="font-bold text-slate-900 block">1. Recommended Material</span>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Use standard A5 Clear Acrylic L-Stand or T-Stand (readily available for ₹80–₹140).
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="font-bold text-slate-900 block">2. Paper Weight</span>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Print on 250–300 GSM photo paper or heavy cardstock to prevent curling or fading.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="font-bold text-slate-900 block">3. Lamination Tip</span>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Hot matte or gloss lamination protects the QR from counter tea spills, grease, and dust.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="font-bold text-slate-900 block">4. Test Before Deploy</span>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Test-scan with both Android Google Lens and iPhone Camera from 1–2 feet away under shop lights.
            </p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          5. QUICK ACTIONS BOTTOM BAR
         ========================================================================= */}
      <div className="no-print bg-slate-900 text-white p-5 rounded-2xl shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-0.5 text-center sm:text-left">
          <h3 className="text-sm font-bold text-white">Ready to deploy your tabletop stand?</h3>
          <p className="text-xs text-slate-300">
            Print flyer in A5/A4 or download high-res PNG for acrylic tabletop stands.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap justify-center">
          <button
            onClick={downloadQrCode}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download QR</span>
          </button>
          <button
            onClick={triggerBrowserPrint}
            className="px-4 py-2.5 bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print QR Stand</span>
          </button>
          <a
            href={`/s/${activeShop.slug || 'shop'}`}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            <span>Open Customer View</span>
          </a>
        </div>
      </div>
    </div>
  );
};
