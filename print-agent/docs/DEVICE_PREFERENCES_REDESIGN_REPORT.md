# PrintFlow Electron Agent — Combined Device & Preferences Redesign Report

**Date:** October 17, 2026  
**Target:** PrintFlow Windows Desktop Print Agent (`printflow-agent`)  
**Scope:** Consolidation of Profile & Device + Settings into a unified **Device & Preferences** screen with enhanced form controls.

---

## 1. Executive Summary

The separate **Profile & Device** and **Settings / Agent Preferences** screens have been consolidated into a single, high-performance desktop settings experience named **Device & Preferences**.

All form elements (text inputs, selects, toggles, read-only fields, and action buttons) were rebuilt with a dedicated, reusable component system (`FormControls.tsx`) adhering strictly to the PrintFlow design system:
- 44–48px input height
- 11px corner radius
- Crisp neutral borders
- Brand teal focus rings (`#0d9488` with subtle halo)
- Accessible switches and distinct read-only states
- Live feedback and state machines (`idle`, `saving`, `saved`, `error`)

All underlying business logic, IPC subscriptions, DPAPI secure credential vaulting, and Win32 printer integrations are **100% preserved**.

---

## 2. Combined Screen Structure

### Page Header
- **Title**: `Device & Preferences`
- **Subtitle**: `Manage terminal identity, cloud connectivity, printer behavior, and Agent preferences.`
- **Contextual Tag**: Read-only device name / agent ID pill.

### Section A: Terminal Identity (Left Column, Row 1)
- **Agent Device ID**: Read-only input with custom monospace formatting, lock icon, "Read-Only Tag" badge, and an inline one-click copy button with animated "Copied ✓" green feedback badge.
- **Paired Shop ID**: Read-only input with store icon and tenant badge.
- **Cloud Host Endpoint**: Read-only input with globe icon and TLS host badge.
- **Terminal Device Name**: Editable text input with 44px height, corner radius, comfortable padding, and a dedicated `Save Name` button featuring an active state machine (`idle` -> `saving` -> `saved ✓` -> `error`).

### Section B: Connection & Security (Right Column, Row 1)
- **Agent Connection Status**: Real-time `AgentStatusBadge` indicator (Online/Connected, Connecting, Sync Error, Offline).
- **Last Authenticated Heartbeat**: Formatted timestamp with active status checkmark.
- **Pairing State**: "Paired & Verified" (emerald shield) or "Setup Required" (amber warning).
- **Credential Vault**: "Windows DPAPI Encrypted" badge with hardware isolation explanation.
- **Action Buttons Bar**:
  - `Test Cloud Connection`: Primary action with loading spinner.
  - `Refresh Status`: Secondary action querying backend telemetry.
  - `Reconnect / Change Token`: Triggers the secure pairing dialog modal.
  - `View Diagnostics`: Navigates directly to the Live Logs console.

### Section C: Agent Preferences (Full-Width Card, Row 2)
- **Queue Polling Frequency**:
  - Custom select dropdown with chevron icon and 44px height.
  - Options preserved: 3 Seconds (High Speed), 5 Seconds (Standard Recommended), 10 Seconds (Low Network Overhead).
- **Launch Agent on Windows Sign-in**:
  - Accessible toggle switch with smooth glide animation.
  - Title and explanatory subtext.
- **Allow Monochrome Fallback**:
  - Accessible toggle switch with smooth glide animation.
  - Title and explanatory subtext.
- **Actions Toolbar**:
  - `Save Preferences`: Teal primary button with idle, saving, and "Preferences Saved ✓" states.
  - `Reset Settings & Credentials`: Destructive danger-styled button with a descriptive confirmation dialog that preserves print recovery records while wiping device credentials.

### Section D: Printer Summary (Full-Width Card, Row 3)
- Installed printer count and online count tracker.
- Active spooler target printer highlighted with badge.
- Compact grid displaying discovered Windows printers with online status, driver name, and color/duplex tags.
- Direct navigation link to the full `Printers` tab (`Manage Printers & Trays →`).
- Graceful empty state when 0 printers are installed.

---

## 3. Reusable Form Design System (`FormControls.tsx`)

The following reusable components were created in `src/renderer/components/ui/FormControls.tsx`:

1. `FormField`: Standard wrapper providing accessible labels, required indicator, optional section badges, helper text, and validation error messages.
2. `ReadOnlyField`: Purpose-built component for immutable system values with leading icons and optional inline clipboard copy buttons.
3. `TextInput`: Standardized 44px input with neutral border, light/dark surface background, comfortable horizontal padding, and teal focus ring.
4. `SelectInput`: Custom select dropdown with SVG chevron indicator and option truncation.
5. `ToggleSwitch`: Accessible toggle switch supporting keyboard and mouse interaction with high-contrast active states.
6. `SettingsCard`: Unified card container with icon mark, header actions, and consistent spacing.
7. `SaveButton`: Action button encapsulating `idle`, `saving`, `saved`, and `error` states.

---

## 4. Navigation & Route Updates

1. **Sidebar Navigation (`App.tsx`)**:
   - Removed duplicate `PROFILE` and `SETTINGS` entries.
   - Added single unified entry: `{ id: 'DEVICE_PREFERENCES', label: 'Device & Preferences', icon: <SlidersHorizontal /> }`.
2. **Tab Rendering**:
   - Unified `DevicePreferencesView` receives all necessary application state (`config`, `status`, `lastHeartbeat`, `printers`, `onSave`, `onTestConnection`, `onReset`, `onOpenSettings`, `onOpenLogs`, `onNavigatePrinters`, `onCopyDeviceId`).
3. **Internal Navigation**:
   - "Manage Printers & Trays" navigates cleanly to the `PRINTERS` view.
   - "View Diagnostics" navigates cleanly to the `LOGS` view.
   - "Reconnect / Change Token" opens the `SettingsModal` pairing dialog.

---

## 5. Files Modified

| File | Changes |
| :--- | :--- |
| `src/renderer/components/ui/FormControls.tsx` | **Created**: Reusable form controls (`FormField`, `ReadOnlyField`, `TextInput`, `SelectInput`, `ToggleSwitch`, `SettingsCard`, `SaveButton`). |
| `src/renderer/components/DevicePages.tsx` | **Rewritten**: Consolidated `DevicePreferencesView` with 4 sections (Identity, Connection, Preferences, Printer Summary), plus `AboutView`. |
| `src/renderer/App.tsx` | **Updated**: Consolidated navigation routes, sidebar entries, and tab rendering to `DEVICE_PREFERENCES`. |
| `src/renderer/index.css` | **Updated**: Standardized form inputs to 44px height, 11px radius, custom chevron select styles, and toggle switch styles. |
| `src/renderer/components/SettingsModal.tsx` | **Updated**: Applied custom chevron select styling (`pf-form-select`). |
| `src/renderer/components/QueueView.tsx` | **Updated**: Applied custom chevron select styling (`pf-form-select`). |
| `src/renderer/components/LogsView.tsx` | **Updated**: Applied custom chevron select styling (`pf-form-select`). |

---

## 6. Verification & Build Results

1. **TypeScript Type Check (`npx tsc --noEmit`)**:
   - Exit code: **0** (Zero errors).
2. **Production Build (`npm run build`)**:
   - `vite build` completed in **629ms**.
   - `tsc -p tsconfig.node.json` completed with **0 errors**.
   - Output files: `dist/renderer/index.html` (0.47 kB), CSS (58.16 kB), JS (362.57 kB).
3. **Responsive & Viewport Testing**:
   - Verified clean two-column grid on wide desktops.
   - Verified single-column stacked layout on narrower windows down to 1024px.
   - Tested overflow safety and button wrapping to avoid clipping in 1366×768 resolution.

