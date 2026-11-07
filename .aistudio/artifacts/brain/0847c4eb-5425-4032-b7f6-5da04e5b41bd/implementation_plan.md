# Implementation Plan - PrintFlow Printer Driver Setup Assistant & Automatic Printer Detection

## User Objective
Build a complete, guided Printer Driver Setup Assistant and automatic printer detection system inside the PrintFlow Windows Electron Agent. This allows shop owners (e.g. Xerox shops) to easily install official drivers, detect USB/Wi-Fi/LAN printers, verify connection readiness, retrieve real hardware capabilities, and synchronize device details with PrintFlow Cloud.

---

## Proposed Architectural Changes

### 1. Main Process IPC & Driver Detection (`print-agent/src/main/main.ts`, `preload.cts`, `WindowsPrinterManager.ts`)
- **IPC Endpoints**:
  - Add `printer:get-driver-status`: Enumerates installed Windows printer driver packages via WMI (`Win32_PrinterDriver`) and matches them against installed printers or selected models.
  - Add `printer:get-manufacturer-links`: Returns official manufacturer driver support resources (HP, Canon, Epson, Brother, Xerox, Ricoh, Kyocera).
- **Driver Verification**:
  - Verify driver name, environment, driver path, and port mapping for each installed printer.
  - Detect driver installation status and report missing drivers clearly.

### 2. Guided Printer Driver Setup Assistant (`print-agent/src/renderer/components/PrinterDriverSetupModal.tsx`)
Create a 5-step wizard component:
- **Step 1: Welcome & Connection Selection**:
  - Displays "Connect Your Printer" overview.
  - Highlights connection types: USB Printer, Wi-Fi Printer, Network / LAN Printer.
  - Action button: `Start Printer Setup`.
- **Step 2: Driver Installation Check**:
  - Checks if official Windows driver is installed for detected hardware.
  - **If Driver Installed**: Shows detected printer and driver package info (Driver Name, Manufacturer, Port, Version).
  - **If Driver Missing / Not Found**: Displays "Printer driver not detected. Please install the official driver for your printer model." Provides official manufacturer links (HP, Canon, Epson, Brother, Xerox, Ricoh, Kyocera), manual model search, and step-by-step installation instructions before clicking `Scan Again`.
- **Step 3: Automatic Printer Detection**:
  - Scans Windows printers across USB, Wi-Fi, Ethernet/LAN, and Shared Spoolers via IPC.
  - Lists detected printers with Name, Manufacturer, Model, Driver Name, Connection Type, Status, Default indicator.
  - Actions: `Scan Again`, `Select Printer`, `Continue`.
- **Step 4: Connection & Status Verification**:
  - Verifies selected printer state: `READY`, `ONLINE`, `OFFLINE`, `PAUSED`, `ERROR`, `PAPER_OUT`, `INITIALIZING`, `UNKNOWN`.
  - Differentiates `ONLINE` vs `READY`.
  - Contextual troubleshooting for offline, paused queue, paper out, or spooler errors.
- **Step 5: Capability Detection & Cloud Synchronization**:
  - Displays retrieved hardware capabilities: Paper Sizes & Dimensions (A4, A3, A5, Letter, Legal, etc.), Color/Monochrome, Duplex (Auto/Manual), Resolutions (DPI), Max Copies, Orientations.
  - Clearly marks unverified or unknown capabilities as `UNKNOWN`/`UNAVAILABLE` without fabricating support.
  - Associates printer with authenticated PrintFlow Shop and Agent, syncing details with PrintFlow Cloud.
  - Handles offline state gracefully with `Cloud Sync Pending` indicators.

### 3. Agent Printer Dashboard Upgrade (`print-agent/src/renderer/components/PrintersView.tsx`)
- Add `Driver & Setup Assistant` button to top controls bar.
- Enhance printer cards with Driver Info, Manufacturer/Model tags, Connection Type badge, Cloud Sync status, and Driver Troubleshooting tips.

### 4. Integration Verification & Testing (`test/printer-driver-setup.test.ts`)
- Automated unit test verifying:
  1. Driver status check and manufacturer support link mapping.
  2. Guided setup state transitions (Welcome -> Driver Check -> Detection -> Verification -> Capabilities -> Cloud Sync).
  3. Real capability extraction and unknown capability handling.
  4. Single and multi-printer cloud synchronization.

---

## Verification Plan

### Build & Compilation Checks
1. Run `npm --prefix print-agent run build` to build renderer and main Electron bundles.
2. Run `compile_applet` and `lint_applet` to verify syntax, imports, and zero TypeScript errors.
3. Execute the automated test suite with `npm test`.
