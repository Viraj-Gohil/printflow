import React from 'react';

export const PrintWorkflowSvg: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`relative w-full ${className}`}>
      <svg
        viewBox="0 0 800 560"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto drop-shadow-xl select-none"
      >
        <defs>
          {/* Brand Gradients */}
          <linearGradient id="pfGreenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00B52D" />
            <stop offset="100%" stopColor="#008A22" />
          </linearGradient>

          <linearGradient id="pfGreenGlow" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00B52D" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#00B52D" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="darkMetalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#080808" />
          </linearGradient>

          <linearGradient id="screenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F8FAFC" />
          </linearGradient>

          <linearGradient id="streamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00B52D" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#00B52D" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#0D9488" stopOpacity="0.2" />
          </linearGradient>

          <linearGradient id="printerBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="50%" stopColor="#F1F5F9" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </linearGradient>

          {/* Shadows */}
          <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#0F172A" floodOpacity="0.08" />
          </filter>

          <filter id="greenGlowFilter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <style>{`
            @keyframes dashFlow {
              0% { stroke-dashoffset: 60; }
              100% { stroke-dashoffset: 0; }
            }
            @keyframes pulseBeam {
              0%, 100% { opacity: 0.4; }
              50% { opacity: 0.95; }
            }
            @keyframes floatPaper {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-4px); }
            }
            .animated-stream {
              stroke-dasharray: 8 12;
              animation: dashFlow 2s linear infinite;
            }
            .pulse-element {
              animation: pulseBeam 2.5s ease-in-out infinite;
            }
            .paper-float {
              animation: floatPaper 3s ease-in-out infinite;
            }
          `}</style>
        </defs>

        {/* Outer Visual Surface Card Background */}
        <rect x="20" y="20" width="760" height="520" rx="28" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="2" filter="url(#cardShadow)" />

        {/* Ambient Top Glow */}
        <path d="M20 48C20 32.536 32.536 20 48 20H752C767.464 20 780 32.536 780 48V100H20V48Z" fill="#F8FAFC" />
        <line x1="20" y1="100" x2="780" y2="100" stroke="#E2E8F0" strokeWidth="1.5" />

        {/* Window Bar Controls */}
        <circle cx="50" cy="60" r="6" fill="#EF4444" />
        <circle cx="70" cy="60" r="6" fill="#F59E0B" />
        <circle cx="90" cy="60" r="6" fill="#00B52D" />
        <text x="114" y="64" fill="#080808" fontSize="13" fontWeight="800" fontFamily="Plus Jakarta Sans, sans-serif">
          PrintFlow Instant Spooler Pipeline
        </text>

        {/* Top Right Live Online Badge */}
        <rect x="620" y="44" width="136" height="32" rx="16" fill="#EAF8ED" stroke="#BBF7D0" strokeWidth="1.5" />
        <circle cx="638" cy="60" r="4" fill="#00B52D" className="pulse-element" />
        <text x="650" y="64" fill="#008A22" fontSize="11" fontWeight="800" fontFamily="JetBrains Mono, monospace">
          LIVE SPOOLING
        </text>

        {/* ========================================================================= */}
        {/* STREAM CONNECTOR PATHS (Mobile -> Cloud -> Printer)                       */}
        {/* ========================================================================= */}
        <path d="M220 280 C 290 220, 350 220, 400 280" stroke="url(#streamGrad)" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M220 280 C 290 220, 350 220, 400 280" stroke="#00B52D" strokeWidth="3" strokeLinecap="round" fill="none" className="animated-stream" />

        <path d="M400 280 C 460 340, 530 340, 580 280" stroke="url(#streamGrad)" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M400 280 C 460 340, 530 340, 580 280" stroke="#00B52D" strokeWidth="3" strokeLinecap="round" fill="none" className="animated-stream" />

        {/* ========================================================================= */}
        {/* STEP 1: MOBILE PHONE SCANNING QR STAND                                   */}
        {/* ========================================================================= */}
        <g id="mobile-qr-section">
          {/* QR Stand Shadow */}
          <ellipse cx="100" cy="460" rx="55" ry="12" fill="#E2E8F0" opacity="0.6" />

          {/* Tabletop Counter QR Stand */}
          <path d="M60 450 L75 350 L125 350 L140 450 Z" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="2" />
          <rect x="75" y="350" width="50" height="70" rx="6" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.5" />
          
          {/* Mini QR Graphic on Stand */}
          <rect x="83" y="358" width="34" height="34" rx="4" fill="#080808" />
          <rect x="87" y="362" width="10" height="10" fill="#FFFFFF" />
          <rect x="89" y="364" width="6" height="6" fill="#00B52D" />
          <rect x="103" y="362" width="10" height="10" fill="#FFFFFF" />
          <rect x="105" y="364" width="6" height="6" fill="#00B52D" />
          <rect x="87" y="378" width="10" height="10" fill="#FFFFFF" />
          <rect x="89" y="380" width="6" height="6" fill="#00B52D" />
          <rect x="101" y="378" width="4" height="4" fill="#FFFFFF" />
          <rect x="107" y="384" width="6" height="6" fill="#FFFFFF" />

          <text x="100" y="406" textAnchor="middle" fill="#008A22" fontSize="7" fontWeight="800" fontFamily="Plus Jakarta Sans">SCAN TO PRINT</text>

          {/* Laser Scanning Cone Beam */}
          <polygon points="100,380 150,190 230,230" fill="url(#pfGreenGlow)" className="pulse-element" />

          {/* Smartphone Frame */}
          <g transform="translate(140, 150) rotate(-6)">
            {/* Phone Shadow */}
            <rect x="6" y="8" width="120" height="230" rx="24" fill="#0F172A" opacity="0.15" />
            {/* Body Outer */}
            <rect x="0" y="0" width="120" height="230" rx="24" fill="#080808" stroke="#334155" strokeWidth="3" />
            {/* Screen Area */}
            <rect x="6" y="10" width="108" height="210" rx="18" fill="url(#screenGrad)" />
            
            {/* Camera Notch */}
            <rect x="42" y="14" width="36" height="6" rx="3" fill="#080808" />

            {/* Mobile App UI Header */}
            <rect x="12" y="28" width="96" height="26" rx="8" fill="#EAF8ED" />
            <circle cx="24" cy="41" r="6" fill="#00B52D" />
            <text x="36" y="44" fill="#008A22" fontSize="8" fontWeight="800" fontFamily="Plus Jakarta Sans">PrintFlow Shop</text>

            {/* Document Upload Preview Box */}
            <rect x="12" y="60" width="96" height="84" rx="10" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" />
            <rect x="20" y="68" width="24" height="28" rx="4" fill="#EAF8ED" stroke="#00B52D" strokeWidth="1" />
            <text x="32" y="85" textAnchor="middle" fill="#00B52D" fontSize="8" fontWeight="800" fontFamily="Plus Jakarta Sans">PDF</text>
            <text x="50" y="76" fill="#080808" fontSize="8" fontWeight="800" fontFamily="Plus Jakarta Sans">Report_Final.pdf</text>
            <text x="50" y="86" fill="#777777" fontSize="7" fontWeight="500">12 Pages · A4</text>
            <text x="50" y="96" fill="#00B52D" fontSize="7" fontWeight="700">B&W Duplex ✓</text>

            {/* Price Row */}
            <rect x="18" y="108" width="84" height="28" rx="6" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1" />
            <text x="24" y="122" fill="#777777" fontSize="7">Calculated Total:</text>
            <text x="24" y="132" fill="#00B52D" fontSize="10" fontWeight="900" fontFamily="JetBrains Mono">₹24.00</text>

            {/* Pay UPI Button */}
            <rect x="12" y="152" width="96" height="28" rx="10" fill="url(#pfGreenGrad)" />
            <text x="60" y="170" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="800" fontFamily="Plus Jakarta Sans">PAY VIA UPI →</text>

            {/* Success Touch Checkmark Badge Floating */}
            <circle cx="106" cy="150" r="14" fill="#00B52D" stroke="#FFFFFF" strokeWidth="2.5" />
            <path d="M99 150 L104 155 L113 145" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </g>

          {/* Step 1 Label Badge */}
          <rect x="80" y="120" width="110" height="28" rx="14" fill="#080808" />
          <text x="135" y="138" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="800" fontFamily="Plus Jakarta Sans">01. SCAN & PAY</text>
        </g>

        {/* ========================================================================= */}
        {/* STEP 2: PRINTFLOW CLOUD ORCHESTRATION & SECURITY STREAM                  */}
        {/* ========================================================================= */}
        <g id="cloud-orchestrator-section" transform="translate(320, 200)">
          {/* Cloud Base Outer Glow */}
          <circle cx="80" cy="80" r="65" fill="#EAF8ED" />
          <circle cx="80" cy="80" r="50" fill="#FFFFFF" stroke="#00B52D" strokeWidth="2" filter="url(#greenGlowFilter)" />

          {/* Cloud Icon graphic */}
          <path d="M60 90 C 52 90, 46 84, 46 76 C 46 69, 51 63, 58 62 C 60 52, 69 45, 80 45 C 90 45, 99 51, 102 61 C 109 61, 114 67, 114 74 C 114 82, 108 88, 100 88 L60 88 Z" fill="#00B52D" />

          {/* Central Shield Lock */}
          <rect x="72" y="70" width="16" height="18" rx="3" fill="#FFFFFF" />
          <path d="M76 70 V65 C76 62, 84 62, 84 65 V70" stroke="#FFFFFF" strokeWidth="2" fill="none" />
          <circle cx="80" cy="78" r="2.5" fill="#00B52D" />

          {/* Floating Data Packet 1 */}
          <g transform="translate(-10, -30)" className="paper-float">
            <rect x="0" y="0" width="90" height="24" rx="12" fill="#080808" />
            <circle cx="12" cy="12" r="4" fill="#00B52D" />
            <text x="22" y="15" fill="#FFFFFF" fontSize="8" fontWeight="800" fontFamily="JetBrains Mono">HMAC VERIFIED</text>
          </g>

          {/* Floating Data Packet 2 */}
          <g transform="translate(80, 110)" className="paper-float">
            <rect x="0" y="0" width="95" height="24" rx="12" fill="#EAF8ED" stroke="#00B52D" strokeWidth="1" />
            <text x="47" y="15" textAnchor="middle" fill="#008A22" fontSize="8" fontWeight="800" fontFamily="JetBrains Mono">TOKEN #84291</text>
          </g>

          {/* Step 2 Label Badge */}
          <rect x="25" y="-60" width="110" height="28" rx="14" fill="#00B52D" />
          <text x="80" y="-42" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="800" fontFamily="Plus Jakarta Sans">02. AUTO ROUTE</text>
        </g>

        {/* ========================================================================= */}
        {/* STEP 3: PROFESSIONAL OFFICE MULTI-FUNCTION PRINTER                       */}
        {/* ========================================================================= */}
        <g id="printer-section" transform="translate(520, 140)">
          {/* Ground Shadow */}
          <ellipse cx="130" cy="350" rx="110" ry="18" fill="#E2E8F0" opacity="0.7" />

          {/* Printer Main Cabinet Base Stand */}
          <rect x="50" y="220" width="160" height="120" rx="8" fill="url(#darkMetalGrad)" stroke="#334155" strokeWidth="2" />
          <line x1="50" y1="280" x2="210" y2="280" stroke="#334155" strokeWidth="1.5" />
          {/* Paper Trays Handles */}
          <rect x="110" y="244" width="40" height="8" rx="4" fill="#475569" />
          <rect x="110" y="304" width="40" height="8" rx="4" fill="#475569" />
          <text x="190" y="252" fill="#94A3B8" fontSize="7" fontWeight="700">TRAY 1 (A4)</text>
          <text x="190" y="312" fill="#94A3B8" fontSize="7" fontWeight="700">TRAY 2 (A3)</text>

          {/* Printer Upper Engine Body */}
          <rect x="30" y="100" width="200" height="120" rx="14" fill="url(#printerBodyGrad)" stroke="#CBD5E1" strokeWidth="2" />

          {/* Top Scanner Lid Glass Assembly */}
          <rect x="25" y="70" width="210" height="30" rx="6" fill="#334155" stroke="#1E293B" strokeWidth="2" />
          <rect x="35" y="75" width="190" height="6" rx="3" fill="#64748B" />

          {/* Interactive LCD Display Panel */}
          <rect x="50" y="112" width="80" height="48" rx="6" fill="#080808" stroke="#475569" strokeWidth="1.5" />
          <rect x="54" y="116" width="72" height="40" rx="4" fill="#0F172A" />
          {/* Screen Content */}
          <circle cx="62" cy="126" r="3" fill="#00B52D" />
          <text x="68" y="128" fill="#00B52D" fontSize="7" fontWeight="800" fontFamily="JetBrains Mono">PRINTING...</text>
          <text x="60" y="140" fill="#FFFFFF" fontSize="8" fontWeight="800" fontFamily="JetBrains Mono">Job #84291</text>
          {/* Progress bar */}
          <rect x="60" y="146" width="60" height="4" rx="2" fill="#334155" />
          <rect x="60" y="146" width="60" height="4" rx="2" fill="#00B52D" />

          {/* Status LEDs */}
          <circle cx="145" cy="120" r="3.5" fill="#00B52D" className="pulse-element" />
          <circle cx="155" cy="120" r="3.5" fill="#334155" />
          <text x="165" y="123" fill="#64748B" fontSize="7" fontWeight="700">ONLINE</text>

          {/* Output Paper Slot & Tray */}
          <rect x="40" y="170" width="180" height="12" rx="3" fill="#1E293B" />

          {/* Output Printed Document Animation */}
          <g transform="translate(65, 178)" className="paper-float">
            {/* Paper Sheet */}
            <rect x="0" y="0" width="130" height="110" rx="4" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
            
            {/* Printed Header Text */}
            <rect x="12" y="14" width="70" height="6" rx="2" fill="#080808" />
            <rect x="12" y="24" width="106" height="3" rx="1.5" fill="#94A3B8" />
            <rect x="12" y="30" width="98" height="3" rx="1.5" fill="#94A3B8" />
            <rect x="12" y="36" width="102" height="3" rx="1.5" fill="#94A3B8" />
            <rect x="12" y="42" width="80" height="3" rx="1.5" fill="#94A3B8" />

            {/* Printed Diagram Chart Graphic */}
            <rect x="12" y="52" width="106" height="26" rx="4" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1" />
            <path d="M20 70 L35 60 L50 66 L65 56 L80 62 L95 58 L108 64" stroke="#00B52D" strokeWidth="2" strokeLinecap="round" fill="none" />

            {/* Bold Green Pickup Counter Token Slip Tag */}
            <g transform="translate(10, 82)">
              <rect x="0" y="0" width="110" height="20" rx="6" fill="#00B52D" />
              <text x="55" y="13" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="900" fontFamily="JetBrains Mono">
                COUNTER TOKEN #84291
              </text>
            </g>
          </g>

          {/* Step 3 Label Badge */}
          <rect x="75" y="20" width="110" height="28" rx="14" fill="#080808" />
          <text x="130" y="38" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="800" fontFamily="Plus Jakarta Sans">03. INSTANT PRINT</text>
        </g>
      </svg>
    </div>
  );
};
