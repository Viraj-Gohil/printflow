# PrintFlow Desktop Agent UI Improvement Plan

## Existing implementation

- The desktop app is an Electron 34 + React 19 + TypeScript + Vite application in `print-agent/`. It uses Tailwind CSS 4 and Lucide icons; it has no React Router or component library to extend.
- `src/renderer/App.tsx` owns the agent state and uses four in-memory tabs: Dashboard, Print Queue, Printers, and Live Logs. The renderer subscribes to main-process status, job, log, and printer events through a narrow `contextBridge` API.
- `Dashboard.tsx`, `QueueView.tsx`, `PrintersView.tsx`, `LogsView.tsx`, `Header.tsx`, and `SettingsModal.tsx` are working React views, but page navigation is limited to the four tabs and several controls report optimistic or unsupported details.
- `PrintAgentService.ts` calls the pairing, heartbeat, job polling/claim/status, printer sync, and document-download APIs through `ApiClient.ts`. Heartbeat is the basis of the online state; job polling and heartbeat timers currently have no overlap protection.
- `WindowsPrinterManager.ts` uses Electron printer enumeration and a Windows PowerShell fallback, and dispatches spool/test print operations from the main process. Capability fields are currently set to `false` when discovery does not know the capability, and printer preferences do not persist enabled/disabled flags.
- `JobQueueManager.ts` persists local jobs and invokes claim, download, spool, and status-update operations. Its retry action currently queues any local job without distinguishing a safely retryable failure from an uncertain physical-print result.
- `LocalDataVault.ts` stores configuration and job recovery records in JSON files under Electron `userData`. It encrypts the device token with Electron `safeStorage`; the preload returns only a public configuration with a blank token. Configuration has no schema version/validation/reset API, the last heartbeat is not persisted, and job persistence errors are logged rather than surfaced.
- `AgentLogger.ts` keeps a bounded in-memory log list and writes its log file, but export currently returns the path rather than invoking a save dialog. Log details are rendered as raw JSON and the view has no pause/auto-scroll controls.
- Electron main process enables `contextIsolation`, disables `nodeIntegration`, and uses a narrow preload API with basic IPC validation. Device unpair/revocation is not present in the exposed contract.
- Current test/build commands: root `npm run agent:build` compiles the desktop renderer and main process. No dedicated desktop-agent test script is defined.

## Gaps against the requested improvements

1. Navigation has no Profile & Device, Settings, or About destinations, page descriptions, or consistent page shell.
2. The dashboard has no last-heartbeat value, displays every discovered printer as READY, assumes unsupported printer capabilities are false, and includes fixed progress values.
3. Queue search/status filters exist, but printer filtering, sorting, details, refresh-state feedback, and safe retry eligibility do not. The table presents customer phone/name details unnecessarily and offers reprint too broadly.
4. Printer listing and test printing work, but unknown capabilities are described as negative capabilities, selected target failures are not shown, and no device enable/disable or OS-default setter is available.
5. Setup state is initialized once rather than refreshed on modal open; pairing requires entering a token again, duplicate clicks are only disabled during the request, and reset/connection-test/status-refresh interfaces are absent.
6. Non-secret settings and credentials are already persisted, but malformed configuration is silently replaced with defaults, no versioned config migration exists, last heartbeat is not durable, and there is no safe reset operation.
7. Log clear is a view-buffer operation, but export does not actually save a selected file; the UI has no pause, auto-scroll, category filter, or sanitized export contract.
8. The displayed version differs from `package.json`; job metrics can present `lastSyncAt` as current time without a successful sync.

## Proposed changes

1. Keep the current React/Tailwind/Lucide stack and replace the tab-only content frame with a keyboard-accessible sidebar navigation for Dashboard, Print Queue, Printers, Live Logs, Profile & Device, Settings, and About. Keep the established four views and connect their navigation callbacks.
2. Add focused Profile & Device, Settings, and About views using only fields provided by local config, runtime status, app metadata, and existing APIs. Show whether a credential exists without ever returning its value to the renderer. Show last heartbeat only after a successful heartbeat; do not invent registration date or shop display name.
3. Make dashboard values derive only from local jobs, discovered printer records, and authenticated service status. Remove guessed progress and forced READY/capability labels; add a heartbeat display and useful refresh/error state.
4. Extend queue controls with printer/status filters, stable newest/oldest sorting, a job detail panel, and explicit manual-attention messaging for interrupted/uncertain print states. Permit retry only for confirmed failures that occur before physical spooling; do not automatically or manually reprint uncertain outcomes.
5. Treat printer capabilities as unknown when discovery does not establish them. Preserve the existing Windows discovery and test-print flow. Add target selection and a status refresh action; do not claim enable/disable or OS-default support unless a main-process operation is implemented.
6. Version and validate local settings, persist the last successful heartbeat, and add a reset operation that clears preferences/configuration without touching recovered jobs. Keep `safeStorage` and token handling in the main process.
7. Refresh setup fields from current config on each open, clearly indicate when a saved token exists without retrieving it, validate required values and backend URL, guard duplicate submissions, and retain the established Shop Dashboard pairing/token-issuance flow.
8. Implement actual sanitized log export through a main-process save dialog; add search/category/severity filters, pause/auto-scroll controls, and keep clear-view distinct from persisted recovery data.
9. Run the desktop build/type checks and existing relevant tests; document any backend or Windows-spooler limitations that cannot be verified in this environment.

## Implementation outcome

- Replaced the four-tab content area with responsive, keyboard-focusable navigation for all seven requested pages. Added Profile & Device, persisted Settings, and About views; existing Electron tray and setup flows remain in place.
- Dashboard and header use real local job/printer records and the last authenticated heartbeat. Removed hardcoded dashboard progress and READY/capability claims; printer capability fields now preserve unknown values.
- Queue now supports ID/filename search, status/printer filters, newest/oldest sorting, refresh, a details dialog, and explicit manual-attention state. Restarted downloads are reset through the authenticated backend status API before requeueing; interrupted spooler submissions and uncertain results cannot be retried. Failures before spool submission can be retried.
- Printer preferences include an agent-only enable/disable list and target printer selection. Test print remains in the main process. No Windows-wide default-printer operation was added because the current contract does not provide one.
- Local settings use a versioned schema, validated values, atomic config-file replacement, safeStorage credential encryption, and durable heartbeat/sync state. Reset clears configuration/status but preserves the job queue and refuses while an operation is actively processing. A legacy plaintext token is migrated when possible; if OS-backed encryption is unavailable, the credential is cleared and the device must be paired again.
- Setup reloads saved non-secret settings each time, never fetches a saved token into the renderer, permits saving preferences without re-pairing, and requires a new token when host/shop identity changes. Pairing uses the existing backend-issued token workflow.
- Follow-up integration connects successful customer payment verification to a backend print-job creation endpoint. Original uploaded PDFs/images are validated and queued for the matching shop; the agent downloads every job file with M2M authorization. Dispatch is idempotent per Razorpay order, and a customer can retry dispatch without paying again.
- Startup now reloads the encrypted credential after Electron becomes ready, avoiding the prior startup path that treated unavailable early `safeStorage` as an empty configuration. A restart was verified to keep the shop/device pairing active and refresh heartbeat/sync timestamps.
- Logs now support severity/category/search filters, pause/resume, auto-scroll, clear-visible-buffer, and a save dialog exporting sanitized recent events without log details.
- Verification executed: `npm run agent:build` and the root `npm test` suite. The agent compiles; the existing repository tests completed successfully. The Vite configuration emits its existing `__dirname` deprecation warning.

## Remaining limitations

- No dedicated desktop-agent test suite exists, so restart persistence, native `safeStorage`, live authenticated offline/auth-failure behavior, physical printer refresh/printing, and navigation against the real preload bridge were not exercised by automated tests here.
- The application can target and agent-disable printers, but cannot change Windows' global default printer or OS-wide enabled state. Printer color/duplex/paper capabilities remain unknown until a reliable Windows query is implemented.
- The customer-to-agent job queue and its uploaded file buffers are still in-memory and are lost when the backend restarts. Image printing depends on the Windows default file handler, and current shell-print execution does not guarantee copies/color/duplex settings.
- The current backend has no device revocation/unpair endpoint; reconnect/re-pair is the supported UI action. Native physical-print output and interrupted-job recovery remain unverified on an actual printer.
